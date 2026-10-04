import { useCallback, useEffect, useRef, useState } from 'react'
import type { Credentials } from '../types/api.ts'
import type { Chat } from '../types/chat.ts'
import { applyNotification, applyPendingStatus, type ApplyResult } from '../services/applyNotification.ts'
import { asGreenApiError, checkAccount, sendMessage } from '../services/greenApiService.ts'
import { useNotificationPoll } from '../hooks/useNotificationPoll.ts'
import { formatPhone } from '../utils/phone.ts'
import { loadActiveChatId, loadChats, saveActiveChatId, saveChats } from '../utils/sessionStore.ts'
import { ChatView } from './ChatView.tsx'
import { Sidebar } from './Sidebar.tsx'

interface MessengerProps {
  credentials: Credentials
  warning: string | null
  onLogout: () => void
}

export function Messenger({ credentials, warning, onLogout }: MessengerProps) {
  const [chats, setChats] = useState<Chat[]>(() => loadChats())
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    const stored = loadActiveChatId()
    return stored && loadChats().some((chat) => chat.chatId === stored) ? stored : null
  })
  const [pollError, setPollError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const chatsRef = useRef(chats)

  useEffect(() => {
    chatsRef.current = chats
    saveChats(chats)
  }, [chats])

  useEffect(() => {
    saveActiveChatId(activeChatId)
  }, [activeChatId])

  const handleNotification = useCallback((body: unknown): ApplyResult => {
    const result = applyNotification(chatsRef.current, body)
    chatsRef.current = result.chats
    setChats(result.chats)
    return result
  }, [])

  const handlePollError = useCallback((message: string | null) => {
    setPollError((current) => (current === message ? current : message))
  }, [])

  useNotificationPoll(credentials, handleNotification, handlePollError)

  const activeChat = chats.find((chat) => chat.chatId === activeChatId) ?? null

  async function handleCreate(phone: string) {
    const account = await checkAccount(credentials, Number(phone))
    const chatId = account.chatId
    const current = chatsRef.current
    const next = current.some((chat) => chat.chatId === chatId)
      ? current
      : [
          {
            chatId,
            phone,
            title: formatPhone(phone),
            messages: [],
            updatedAt: Date.now(),
          },
          ...current,
        ]

    chatsRef.current = next
    setChats(next)
    setActiveChatId(chatId)
    setSendError(null)
  }

  async function handleSend(text: string): Promise<boolean> {
    if (!activeChat || sending) return false
    const chatId = activeChat.chatId
    setSending(true)
    setSendError(null)

    try {
      const response = await sendMessage(credentials, chatId, text)
      const message = applyPendingStatus({
        id: response.idMessage,
        idMessage: response.idMessage,
        text,
        direction: 'out',
        timestamp: Date.now(),
        status: 'sent',
      })
      const next = chatsRef.current.map((chat) => {
        if (chat.chatId !== chatId) return chat
        if (chat.messages.some((item) => item.idMessage === response.idMessage)) return chat
        return {
          ...chat,
          messages: [...chat.messages, message],
          updatedAt: message.timestamp,
        }
      })
      chatsRef.current = next
      setChats(next)
      return true
    } catch (error) {
      setSendError(asGreenApiError(error).message)
      return false
    } finally {
      setSending(false)
    }
  }

  return (
    <main className={activeChat ? 'shell shell--open' : 'shell'}>
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        instanceId={credentials.idInstance}
        pollError={pollError}
        warning={warning}
        onSelect={(chatId) => {
          setActiveChatId(chatId)
          setSendError(null)
        }}
        onCreate={handleCreate}
        onLogout={onLogout}
      />
      <ChatView
        chat={activeChat}
        sending={sending}
        error={sendError}
        notice={pollError}
        onBack={() => setActiveChatId(null)}
        onSend={handleSend}
      />
    </main>
  )
}
