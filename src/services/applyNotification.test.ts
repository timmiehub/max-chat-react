import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import type { Chat, ChatMessage } from '../types/chat.ts'
import {
  applyNotification,
  applyPendingStatus,
  clearPendingStatuses,
  peekPendingStatus,
} from './applyNotification.ts'

beforeEach(() => {
  clearPendingStatuses()
})

function incoming(typeMessage: string, extra: Record<string, unknown>, idMessage = 'in-1'): Record<string, unknown> {
  return {
    typeWebhook: 'incomingMessageReceived',
    timestamp: 1763115112,
    idMessage,
    senderData: {
      chatId: '10000000',
      chatType: 'user',
      senderName: 'Анна',
      senderPhoneNumber: 79991234567,
    },
    messageData: { typeMessage, ...extra },
  }
}

function status(idMessage: string, value: string): Record<string, unknown> {
  return {
    typeWebhook: 'outgoingMessageStatus',
    timestamp: 1763115200,
    idMessage,
    chatId: '10000000',
    status: value,
  }
}

function outgoing(idMessage: string): ChatMessage {
  return {
    id: idMessage,
    idMessage,
    text: 'Привет',
    direction: 'out',
    timestamp: 1_700_000_000_000,
    status: 'sent',
  }
}

describe('входящие сообщения', () => {
  it('показывает обычный textMessage', () => {
    const result = applyNotification([], incoming('textMessage', {
      textMessageData: { textMessage: 'Привет' },
    }))

    assert.equal(result.ack, true)
    assert.equal(result.chats[0]?.messages[0]?.text, 'Привет')
    assert.equal(result.chats[0]?.messages[0]?.direction, 'in')
  })

  it('показывает quotedMessage из extendedTextMessageData.text', () => {
    const result = applyNotification([], incoming('quotedMessage', {
      extendedTextMessageData: { text: 'Ответ на сообщение', stanzaId: '1', participant: '10000000' },
    }))

    assert.equal(result.ack, true)
    assert.equal(result.chats[0]?.messages[0]?.text, 'Ответ на сообщение')
    assert.equal(result.chats[0]?.messages[0]?.direction, 'in')
  })

  it('не подтверждает неизвестный тип входящего сообщения', () => {
    const result = applyNotification([], incoming('imageMessage', {
      fileMessageData: { downloadUrl: 'https://example.com/a.jpg' },
    }))

    assert.equal(result.ack, false)
    assert.equal(result.hold, false)
    assert.equal(result.chats.length, 0)
    assert.ok(result.reason)
  })

  it('не подтверждает текстовое сообщение без текста', () => {
    const plain = applyNotification([], incoming('textMessage', { textMessageData: { textMessage: '   ' } }))
    const quote = applyNotification([], incoming('quotedMessage', { extendedTextMessageData: { text: '' } }, 'in-2'))

    assert.equal(plain.ack, false)
    assert.equal(quote.ack, false)
    assert.equal(plain.chats.length, 0)
  })

  it('не дублирует сообщение с тем же idMessage', () => {
    const first = applyNotification([], incoming('textMessage', { textMessageData: { textMessage: 'Привет' } }))
    const second = applyNotification(first.chats, incoming('textMessage', { textMessageData: { textMessage: 'Привет' } }))

    assert.equal(second.ack, true)
    assert.equal(second.chats[0]?.messages.length, 1)
  })
})

describe('статус исходящего сообщения', () => {
  it('сохраняет статус, если сообщения ещё нет, и применяет его при отправке', () => {
    const early = applyNotification([], status('out-1', 'read'))

    assert.equal(early.ack, false)
    assert.equal(early.hold, true)
    assert.equal(early.chats.length, 0)
    assert.equal(peekPendingStatus('out-1')?.status, 'read')

    const message = applyPendingStatus(outgoing('out-1'))
    assert.equal(message.status, 'read')
    assert.equal(peekPendingStatus('out-1'), undefined)
  })

  it('применяет статус, если сообщение уже есть', () => {
    const chats: Chat[] = [{
      chatId: '10000000',
      phone: '79991234567',
      title: 'Анна',
      updatedAt: 1,
      messages: [outgoing('out-1')],
    }]
    const result = applyNotification(chats, status('out-1', 'delivered'))

    assert.equal(result.ack, true)
    assert.equal(result.hold, false)
    assert.equal(result.chats[0]?.messages[0]?.status, 'delivered')
  })
})
