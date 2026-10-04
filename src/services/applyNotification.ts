import type { Chat, ChatMessage, OutgoingStatus } from '../types/chat.ts'
import { formatPhone } from '../utils/phone.ts'
import { unixToMs } from '../utils/time.ts'

export interface ApplyResult {
  chats: Chat[]
  ack: boolean
  hold: boolean
  reason: string | null
}

interface IncomingText {
  idMessage: string
  timestamp: number
  chatId: string
  text: string
  phone: string
  title: string
}

interface StatusUpdate {
  idMessage: string
  timestamp: number
  status: OutgoingStatus
  error?: string
}

interface PendingStatus {
  status: OutgoingStatus
  error?: string
  timestamp: number
}

const pendingStatuses = new Map<string, PendingStatus>()

export function clearPendingStatuses() {
  pendingStatuses.clear()
}

export function peekPendingStatus(idMessage: string): PendingStatus | undefined {
  return pendingStatuses.get(idMessage)
}

export function applyPendingStatus(message: ChatMessage): ChatMessage {
  const pending = pendingStatuses.get(message.idMessage)
  if (!pending || message.direction !== 'out') return message
  pendingStatuses.delete(message.idMessage)
  const status = mergeStatus(message.status, pending.status)
  return {
    ...message,
    status,
    error: status === 'failed' ? pending.error : undefined,
  }
}

export function applyNotification(chats: Chat[], body: unknown): ApplyResult {
  if (!isRecord(body)) {
    return blocked(chats, 'Уведомление без данных. Получение остановлено, из очереди оно не удалено.')
  }

  if (body.typeWebhook === 'incomingMessageReceived') {
    return applyIncoming(chats, body)
  }

  if (body.typeWebhook === 'outgoingMessageStatus') {
    return applyOutgoingStatus(chats, body)
  }

  return done(chats)
}

function applyIncoming(chats: Chat[], body: Record<string, unknown>): ApplyResult {
  const incoming = readIncoming(body)
  if (incoming.kind === 'blocked') return blocked(chats, incoming.reason)
  if (chats.some((chat) => chat.messages.some((message) => message.idMessage === incoming.message.idMessage))) {
    return done(chats)
  }

  const message: ChatMessage = {
    id: incoming.message.idMessage,
    idMessage: incoming.message.idMessage,
    text: incoming.message.text,
    direction: 'in',
    timestamp: incoming.message.timestamp,
  }
  const index = chats.findIndex((chat) => chat.chatId === incoming.message.chatId)

  if (index === -1) {
    return done([
      {
        chatId: incoming.message.chatId,
        phone: incoming.message.phone,
        title: incoming.message.title,
        messages: [message],
        updatedAt: incoming.message.timestamp,
      },
      ...chats,
    ])
  }

  return done(chats.map((chat, chatIndex) => {
    if (chatIndex !== index) return chat
    const canUseIncomingTitle = isGenericTitle(chat.title, chat.phone, chat.chatId)
      && !isGenericTitle(incoming.message.title, incoming.message.phone, incoming.message.chatId)
    return {
      ...chat,
      phone: chat.phone || incoming.message.phone,
      title: canUseIncomingTitle ? incoming.message.title : chat.title,
      messages: [...chat.messages, message],
      updatedAt: incoming.message.timestamp,
    }
  }))
}

function applyOutgoingStatus(chats: Chat[], body: Record<string, unknown>): ApplyResult {
  const update = readStatus(body)
  if (!update) {
    return blocked(chats, 'Статус сообщения пришёл в непонятном виде. Получение остановлено, уведомление не удалено.')
  }

  if (!hasOutgoingMessage(chats, update.idMessage)) {
    pendingStatuses.set(update.idMessage, {
      status: update.status,
      error: update.error,
      timestamp: update.timestamp,
    })
    return held(chats)
  }

  pendingStatuses.delete(update.idMessage)
  return done(patchStatus(chats, update))
}

function patchStatus(chats: Chat[], update: StatusUpdate): Chat[] {
  return chats.map((chat) => {
    const index = chat.messages.findIndex((message) => message.idMessage === update.idMessage)
    if (index === -1) return chat
    const current = chat.messages[index]
    if (!current || current.direction !== 'out') return chat
    const status = mergeStatus(current.status, update.status)
    if (status === current.status && current.error === update.error) return chat
    const messages = chat.messages.slice()
    messages[index] = {
      ...current,
      status,
      error: status === 'failed' ? update.error : undefined,
    }
    return {
      ...chat,
      messages,
      updatedAt: Math.max(chat.updatedAt, update.timestamp),
    }
  })
}

function hasOutgoingMessage(chats: Chat[], idMessage: string): boolean {
  return chats.some((chat) => chat.messages.some((message) => message.idMessage === idMessage && message.direction === 'out'))
}

function readIncoming(body: Record<string, unknown>): { kind: 'ok'; message: IncomingText } | { kind: 'blocked'; reason: string } {
  if (typeof body.idMessage !== 'string' || !body.idMessage) {
    return { kind: 'blocked', reason: 'Входящее сообщение без идентификатора. Получение остановлено, уведомление не удалено.' }
  }

  const sender = isRecord(body.senderData) ? body.senderData : null
  const message = isRecord(body.messageData) ? body.messageData : null
  if (!sender || !message || typeof sender.chatId !== 'string' || !sender.chatId) {
    return { kind: 'blocked', reason: 'Входящее сообщение пришло в непонятном виде. Получение остановлено, уведомление не удалено.' }
  }

  if (typeof sender.chatType === 'string' && sender.chatType !== 'user') {
    return { kind: 'blocked', reason: 'В очереди сообщение не из личного чата. Получение остановлено, чтобы не удалить его.' }
  }

  const text = readMessageText(message)
  if (text.kind === 'blocked') return text

  const phone = typeof sender.senderPhoneNumber === 'number' && sender.senderPhoneNumber > 0
    ? String(sender.senderPhoneNumber)
    : ''
  const name = firstText(sender.senderContactName, sender.senderName, sender.chatName)

  return {
    kind: 'ok',
    message: {
      idMessage: body.idMessage,
      timestamp: typeof body.timestamp === 'number' ? unixToMs(body.timestamp) : Date.now(),
      chatId: sender.chatId,
      text: text.value,
      phone,
      title: name || (phone ? formatPhone(phone) : sender.chatId),
    },
  }
}

function readMessageText(message: Record<string, unknown>): { kind: 'ok'; value: string } | { kind: 'blocked'; reason: string } {
  if (message.typeMessage === 'textMessage') {
    const textData = isRecord(message.textMessageData) ? message.textMessageData : null
    const text = textData && typeof textData.textMessage === 'string' ? textData.textMessage.trim() : ''
    if (!text) {
      return { kind: 'blocked', reason: 'Пришло текстовое сообщение без текста. Получение остановлено, уведомление не удалено.' }
    }
    return { kind: 'ok', value: text }
  }

  if (message.typeMessage === 'quotedMessage') {
    const quote = isRecord(message.extendedTextMessageData) ? message.extendedTextMessageData : null
    const text = quote && typeof quote.text === 'string' ? quote.text.trim() : ''
    if (!text) {
      return { kind: 'blocked', reason: 'Пришёл ответ без текста. Получение остановлено, уведомление не удалено.' }
    }
    return { kind: 'ok', value: text }
  }

  return { kind: 'blocked', reason: 'В очереди сообщение, которое этот чат не показывает. Получение остановлено, чтобы не удалить его.' }
}

function readStatus(body: Record<string, unknown>): StatusUpdate | null {
  if (typeof body.idMessage !== 'string' || !body.idMessage) return null
  const status = mapApiStatus(body.status)
  if (!status) return null
  return {
    idMessage: body.idMessage,
    timestamp: typeof body.timestamp === 'number' ? unixToMs(body.timestamp) : Date.now(),
    status,
    error: status === 'failed' ? statusError(body.status, body.description) : undefined,
  }
}

function mergeStatus(current: OutgoingStatus | undefined, incoming: OutgoingStatus): OutgoingStatus {
  if (incoming === 'failed') return 'failed'
  if (current === 'failed') return 'failed'
  if (current === 'read') return 'read'
  if (incoming === 'read') return 'read'
  if (current === 'delivered' && incoming === 'sent') return 'delivered'
  return incoming
}

function mapApiStatus(status: unknown): OutgoingStatus | null {
  if (status === 'delivered') return 'delivered'
  if (status === 'read') return 'read'
  if (status === 'failed' || status === 'noAccount' || status === 'notInGroup') return 'failed'
  return null
}

function statusError(status: unknown, description: unknown): string {
  if (status === 'noAccount') return 'На этом номере нет аккаунта MAX.'
  if (status === 'notInGroup') return 'Отправка в этот чат недоступна.'
  if (typeof description === 'string' && description.trim() && description.length <= 160 && !description.includes('{')) {
    return description.trim()
  }
  return 'Не удалось доставить сообщение.'
}

function isGenericTitle(title: string, phone: string, chatId: string): boolean {
  return title === chatId || title === phone || title === formatPhone(phone)
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function done(chats: Chat[]): ApplyResult {
  return { chats, ack: true, hold: false, reason: null }
}

function held(chats: Chat[]): ApplyResult {
  return { chats, ack: false, hold: true, reason: null }
}

function blocked(chats: Chat[], reason: string): ApplyResult {
  return { chats, ack: false, hold: false, reason }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
