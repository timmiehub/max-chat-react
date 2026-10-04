import { formatPhone } from '../utils/phone.ts'

interface AvatarProps {
  title: string
  phone: string
  seed: string
}

export function Avatar({ title, phone, seed }: AvatarProps) {
  return (
    <span className="avatar" style={{ backgroundColor: avatarColor(seed) }} aria-hidden="true">
      {avatarLabel(title, phone)}
    </span>
  )
}

const COLORS = ['#3d7dff', '#6a5ae0', '#2f9d8f', '#e07a3d', '#d4537e', '#3e9a55']

function avatarColor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length] ?? '#3d7dff'
}

function avatarLabel(title: string, phone: string): string {
  const formatted = formatPhone(phone)
  if (title && title !== formatted && title !== phone) {
    const letters = title.replace(/[^A-Za-zА-Яа-яЁё0-9]/g, '')
    if (letters) return letters.slice(0, 2).toUpperCase()
  }
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-2) || title.slice(0, 2).toUpperCase() || '•'
}
