import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../types/chat.ts'
import { formatTime } from '../utils/time.ts'

interface MessageListProps {
  chatId: string
  messages: ChatMessage[]
}

export function MessageList({ chatId, messages }: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)

  useEffect(() => {
    stickRef.current = true
    const element = scrollerRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [chatId])

  useEffect(() => {
    const element = scrollerRef.current
    if (!element || !stickRef.current) return
    element.scrollTop = element.scrollHeight
  }, [messages])

  return (
    <div
      className="messages"
      ref={scrollerRef}
      onScroll={(event) => {
        const element = event.currentTarget
        stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
      }}
    >
      {messages.length === 0 ? (
        <p className="empty">Сообщений пока нет.</p>
      ) : (
        messages.map((message) => (
          <article key={message.id} className={message.direction === 'out' ? 'bubble out' : 'bubble in'}>
            <p>{message.text}</p>
            <footer>
              <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
              {message.direction === 'out' && message.status ? <span>{statusLabel(message.status)}</span> : null}
            </footer>
            {message.error ? <p className="bubble-error">{message.error}</p> : null}
          </article>
        ))
      )}
    </div>
  )
}

function statusLabel(status: NonNullable<ChatMessage['status']>): string {
  if (status === 'delivered') return 'доставлено'
  if (status === 'read') return 'прочитано'
  if (status === 'failed') return 'не отправлено'
  return 'отправлено'
}
