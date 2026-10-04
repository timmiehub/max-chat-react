export function unixToMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return Date.now()
  return value < 1_000_000_000_000 ? value * 1000 : value
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function formatChatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()

  if (sameDay) return formatTime(timestamp)

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}
