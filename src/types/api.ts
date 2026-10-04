export interface Credentials {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export interface SendMessageResponse {
  idMessage: string
}

export interface CheckAccountResponse {
  exist: boolean
  chatId: string
}

export interface ReceiveNotification {
  receiptId: number
  body: unknown
}
