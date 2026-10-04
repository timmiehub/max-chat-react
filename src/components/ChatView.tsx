import type { Chat } from '../types/chat.ts'
import { Avatar } from './Avatar.tsx'
import { Composer } from './Composer.tsx'
import { MessageList } from './MessageList.tsx'
import { formatPhone } from '../utils/phone.ts'

interface ChatViewProps {
  chat: Chat | null
  sending: boolean
  error: string | null
  notice: string | null
  onBack: () => void
  onSend: (text: string) => Promise<boolean>
}

export function ChatView({ chat, sending, error, notice, onBack, onSend }: ChatViewProps) {
  const pollNotice = notice ? <p className="banner poll-notice" role="alert">{notice}</p> : null

  if (!chat) {
    return (
      <section className="chat-pane">
        {pollNotice}
        <div className="chat-placeholder">
          <h2>Выберите чат</h2>
          <p>Или создайте новый по номеру телефона.</p>
        </div>
      </section>
    )
  }

  const phone = formatPhone(chat.phone)
  const showPhone = Boolean(phone) && phone !== chat.title

  return (
    <section className="chat-pane">
      <header className="chat-header">
        <button type="button" className="back" onClick={onBack}>Назад</button>
        <Avatar title={chat.title} phone={chat.phone} seed={chat.chatId} />
        <div className="chat-heading">
          <h2>{chat.title}</h2>
          {showPhone ? <p>{phone}</p> : null}
        </div>
      </header>

      {pollNotice}

      <MessageList chatId={chat.chatId} messages={chat.messages} />

      {error ? <p className="banner" role="alert">{error}</p> : null}

      <Composer key={chat.chatId} sending={sending} onSend={onSend} />
    </section>
  )
}
