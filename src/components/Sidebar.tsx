import { useState, type FormEvent } from 'react'
import type { Chat } from '../types/chat.ts'
import { Avatar } from './Avatar.tsx'
import { formatChatTime } from '../utils/time.ts'
import { formatPhone, normalizePhone } from '../utils/phone.ts'

interface SidebarProps {
  chats: Chat[]
  activeChatId: string | null
  instanceId: string
  pollError: string | null
  warning: string | null
  onSelect: (chatId: string) => void
  onCreate: (phone: string) => Promise<void>
  onLogout: () => void
}

export function Sidebar({
  chats,
  activeChatId,
  instanceId,
  pollError,
  warning,
  onSelect,
  onCreate,
  onLogout,
}: SidebarProps) {
  const [creating, setCreating] = useState(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setError('Введите номер в формате 79991234567 или 375291234567.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      await onCreate(normalized)
      setPhone('')
      setCreating(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось создать чат.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Чаты</h1>
        </div>
        <button
          type="button"
          className="primary compact"
          aria-expanded={creating}
          onClick={() => setCreating((open) => !open)}
        >
          {creating ? 'Закрыть' : 'Новый чат'}
        </button>
      </header>

      {creating ? (
        <form className="new-chat" onSubmit={handleCreate}>
          <label>
            Номер телефона
            <input
              name="phone"
              inputMode="tel"
              placeholder="79991234567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={loading}
              autoFocus
            />
          </label>
          {error ? <p className="banner" role="alert">{error}</p> : null}
          <button className="primary" type="submit" disabled={loading || !phone.trim()}>
            {loading ? 'Проверяем номер…' : 'Создать'}
          </button>
        </form>
      ) : null}

      {warning ? <p className="banner" role="alert">{warning}</p> : null}
      {pollError ? <p className="banner" role="alert">{pollError}</p> : null}

      <div className="chat-list">
        {sorted.length === 0 ? (
          <p className="empty">Чатов пока нет. Создайте чат по номеру телефона.</p>
        ) : (
          sorted.map((chat) => {
            const last = chat.messages[chat.messages.length - 1]
            return (
              <button
                key={chat.chatId}
                type="button"
                className={chat.chatId === activeChatId ? 'chat-row is-active' : 'chat-row'}
                aria-current={chat.chatId === activeChatId ? 'true' : undefined}
                onClick={() => onSelect(chat.chatId)}
              >
                <Avatar title={chat.title} phone={chat.phone} seed={chat.chatId} />
                <span className="chat-row-body">
                  <span className="chat-row-top">
                    <span className="chat-title">{chat.title}</span>
                    {last ? <time dateTime={new Date(last.timestamp).toISOString()}>{formatChatTime(last.timestamp)}</time> : null}
                  </span>
                  <span className="chat-preview">{previewText(chat)}</span>
                  {chat.phone && chat.title !== formatPhone(chat.phone) ? (
                    <span className="chat-phone">{formatPhone(chat.phone)}</span>
                  ) : null}
                </span>
              </button>
            )
          })
        )}
      </div>

      <footer className="sidebar-footer">
        <span>Инстанс {instanceId}</span>
        <button type="button" className="ghost" onClick={onLogout}>Выйти</button>
      </footer>
    </aside>
  )
}

function previewText(chat: Chat): string {
  const last = chat.messages[chat.messages.length - 1]
  if (!last) return 'Нет сообщений'
  return last.direction === 'out' ? `Вы: ${last.text}` : last.text
}
