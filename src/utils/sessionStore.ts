import type { Chat, ChatMessage, OutgoingStatus } from '../types/chat.ts'

const CHATS_KEY = 'max-chat-chats'
const ACTIVE_CHAT_KEY = 'max-chat-active'
const LEGACY_CREDENTIALS_KEY = 'max-chat-credentials'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readJson(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Session storage can be unavailable in private mode.
  }
}

export function forgetStoredCredentials() {
  try {
    sessionStorage.removeItem(LEGACY_CREDENTIALS_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}

export function loadChats(): Chat[] {
  const value = readJson(CHATS_KEY)
  if (!Array.isArray(value)) return []
  return value.filter(isChat)
}

export function saveChats(chats: Chat[]) {
  writeJson(CHATS_KEY, chats)
}

export function loadActiveChatId(): string | null {
  const value = readJson(ACTIVE_CHAT_KEY)
  return typeof value === 'string' && value ? value : null
}

export function saveActiveChatId(chatId: string | null) {
  if (!chatId) {
    try {
      sessionStorage.removeItem(ACTIVE_CHAT_KEY)
    } catch {
      // Ignore unavailable storage.
    }
    return
  }
  writeJson(ACTIVE_CHAT_KEY, chatId)
}

export function clearSession() {
  try {
    sessionStorage.removeItem(LEGACY_CREDENTIALS_KEY)
    sessionStorage.removeItem(CHATS_KEY)
    sessionStorage.removeItem(ACTIVE_CHAT_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}

function isStatus(value: unknown): value is OutgoingStatus {
  return value === 'sent' || value === 'delivered' || value === 'read' || value === 'failed'
}

function isMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || typeof value.idMessage !== 'string') return false
  if (typeof value.text !== 'string') return false
  if (value.direction !== 'in' && value.direction !== 'out') return false
  if (typeof value.timestamp !== 'number') return false
  if (value.status !== undefined && !isStatus(value.status)) return false
  if (value.error !== undefined && typeof value.error !== 'string') return false
  return true
}

function isChat(value: unknown): value is Chat {
  if (!isRecord(value)) return false
  if (typeof value.chatId !== 'string' || !value.chatId) return false
  if (typeof value.phone !== 'string' || typeof value.title !== 'string') return false
  if (typeof value.updatedAt !== 'number' || !Array.isArray(value.messages)) return false
  return value.messages.every(isMessage)
}
