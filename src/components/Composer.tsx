import { useRef, useState } from 'react'

interface ComposerProps {
  sending: boolean
  onSend: (text: string) => Promise<boolean>
}

const MAX_LENGTH = 4000

export function Composer({ sending, onSend }: ComposerProps) {
  const [value, setValue] = useState('')
  const pendingRef = useRef(false)
  const tooLong = value.length > MAX_LENGTH
  const canSend = value.trim().length > 0 && !tooLong && !sending

  async function submit() {
    const text = value.trim()
    if (!text || tooLong || pendingRef.current) return
    pendingRef.current = true
    try {
      const sent = await onSend(text)
      if (sent) setValue('')
    } finally {
      pendingRef.current = false
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <textarea
        rows={1}
        aria-label="Сообщение"
        placeholder="Сообщение"
        value={value}
        maxLength={MAX_LENGTH}
        disabled={sending}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          void submit()
        }}
      />
      <button className="send" type="submit" disabled={!canSend} aria-label="Отправить" aria-busy={sending}>
        {sending ? '…' : <SendIcon />}
      </button>
    </form>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M3.4 11.2 20 4.2c.8-.3 1.6.5 1.3 1.3l-7 16.6c-.3.8-1.5.8-1.8 0l-2.4-6.1-6.1-2.4c-.8-.3-.8-1.5 0-1.8z" />
    </svg>
  )
}
