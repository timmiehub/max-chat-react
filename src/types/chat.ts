export type OutgoingStatus = 'sent' | 'delivered' | 'read' | 'failed'

export interface ChatMessage {
  id: string
  idMessage: string
  text: string
  direction: 'in' | 'out'
  timestamp: number
  status?: OutgoingStatus
  error?: string
}

export interface Chat {
  chatId: string
  phone: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}
