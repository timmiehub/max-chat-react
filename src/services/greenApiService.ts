import type {
  CheckAccountResponse,
  Credentials,
  ReceiveNotification,
  SendMessageResponse,
} from '../types/api.ts'

const RECEIVE_TIMEOUT_SECONDS = 10

export const INCOMING_DISABLED_MESSAGE = 'Получение сообщений выключено. В кабинете GREEN-API включите входящие уведомления и очистите webhook URL. Затем обновите страницу.'

export class GreenApiError extends Error {
  readonly status: number | null
  readonly fatal: boolean

  constructor(message: string, status: number | null = null, fatal = false) {
    super(message)
    this.name = 'GreenApiError'
    this.status = status
    this.fatal = fatal
  }
}

export function normalizeApiUrl(input: string): string {
  const trimmed = input.trim()
  let url: URL

  try {
    url = new URL(trimmed)
  } catch {
    throw new GreenApiError('Введите адрес API как в кабинете, например https://3100.api.green-api.com')
  }

  if (url.protocol !== 'https:') {
    throw new GreenApiError('Адрес API должен начинаться с https://')
  }

  const marker = url.pathname.indexOf('/waInstance')
  const pathname = marker >= 0 ? url.pathname.slice(0, marker) : url.pathname
  const basePath = pathname === '/' ? '' : pathname.replace(/\/$/, '')
  return `${url.origin}${basePath}`
}

export function normalizeCredentials(input: Credentials): Credentials {
  const idInstance = input.idInstance.trim()
  const apiTokenInstance = input.apiTokenInstance.trim()

  if (!/^\d{4,20}$/.test(idInstance)) {
    throw new GreenApiError('idInstance — это число из личного кабинета.')
  }

  if (apiTokenInstance.length < 8 || /\s/.test(apiTokenInstance)) {
    throw new GreenApiError('Вставьте apiTokenInstance из личного кабинета.')
  }

  return {
    apiUrl: normalizeApiUrl(input.apiUrl),
    idInstance,
    apiTokenInstance,
  }
}

export async function incomingNotificationsAvailable(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await request(credentials, 'getSettings', { method: 'GET', signal })
  if (!isRecord(data)) return true

  const webhookUrl = typeof data.webhookUrl === 'string' ? data.webhookUrl.trim() : ''
  if (webhookUrl) return false
  if (data.incomingWebhook === 'no') return false
  return true
}

export async function connect(credentials: Credentials): Promise<string | null> {
  const state = await getStateInstance(credentials)

  switch (state) {
    case 'authorized':
      return null
    case 'suspended':
      return 'На аккаунте временные ограничения: писать можно только тем, кто сохранил ваш номер.'
    case 'notAuthorized':
      throw new GreenApiError('Инстанс не авторизован. Подключите MAX в личном кабинете GREEN-API.')
    case 'blocked':
      throw new GreenApiError('Аккаунт MAX заблокирован.')
    case 'starting':
      throw new GreenApiError('Инстанс ещё запускается. Подождите несколько минут и войдите снова.')
    case 'pendingPassword':
      throw new GreenApiError('Нужно завершить вход: в кабинете GREEN-API введите пароль двухфакторной защиты.')
    default:
      throw new GreenApiError('Не удалось определить состояние инстанса. Проверьте данные в кабинете.')
  }
}

export async function checkAccount(
  credentials: Credentials,
  phoneNumber: number,
  signal?: AbortSignal,
): Promise<CheckAccountResponse> {
  const data = await request(credentials, 'checkAccount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber }),
    signal,
  })

  if (!isRecord(data) || typeof data.exist !== 'boolean') {
    throw new GreenApiError('Не удалось проверить номер.')
  }

  if (!data.exist || typeof data.chatId !== 'string' || !data.chatId) {
    throw new GreenApiError('На этом номере нет аккаунта MAX.')
  }

  return { exist: true, chatId: data.chatId }
}

export async function sendMessage(
  credentials: Credentials,
  chatId: string,
  message: string,
  signal?: AbortSignal,
): Promise<SendMessageResponse> {
  const data = await request(credentials, 'sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
    signal,
  })

  if (!isRecord(data) || typeof data.idMessage !== 'string' || !data.idMessage) {
    throw new GreenApiError('Сообщение не отправлено: сервис не подтвердил отправку.')
  }

  return { idMessage: data.idMessage }
}

export async function receiveNotification(
  credentials: Credentials,
  signal: AbortSignal,
): Promise<ReceiveNotification | null> {
  const data = await request(
    credentials,
    `receiveNotification?receiveTimeout=${RECEIVE_TIMEOUT_SECONDS}`,
    { method: 'GET', signal },
  )

  if (data === null) return null

  const hasReceipt = isRecord(data) && typeof data.receiptId === 'number'
  if (!isRecord(data) || typeof data.receiptId !== 'number' || !isRecord(data.body) || typeof data.body.typeWebhook !== 'string') {
    throw new GreenApiError(
      hasReceipt
        ? 'Очередь уведомлений вернула непонятное сообщение. Получение остановлено, уведомление не удалено.'
        : 'Очередь уведомлений вернула ответ без номера. Получение остановлено.',
      200,
      true,
    )
  }

  return { receiptId: data.receiptId, body: data.body }
}

export async function deleteNotification(
  credentials: Credentials,
  receiptId: number,
  signal: AbortSignal,
): Promise<void> {
  await request(
    credentials,
    'deleteNotification',
    { method: 'DELETE', signal },
    String(receiptId),
  )
}

export function asGreenApiError(error: unknown): GreenApiError {
  if (error instanceof GreenApiError) return error
  return new GreenApiError('Не удалось выполнить запрос. Проверьте соединение и данные инстанса.')
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function getStateInstance(credentials: Credentials): Promise<string> {
  const data = await request(credentials, 'getStateInstance', { method: 'GET' })

  if (!isRecord(data) || typeof data.stateInstance !== 'string') {
    throw new GreenApiError('Не удалось проверить инстанс.')
  }

  return data.stateInstance
}

async function request(
  credentials: Credentials,
  methodPath: string,
  init: RequestInit,
  extraPath = '',
): Promise<unknown> {
  const url = endpoint(credentials, methodPath, extraPath)
  let response: Response

  try {
    response = await fetch(url, init)
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new GreenApiError('Нет соединения с GREEN-API. Проверьте адрес API и интернет.')
  }

  const text = (await response.text()).trim()

  if (!response.ok) {
    const redacted = redact(text, credentials.apiTokenInstance)
    throw new GreenApiError(
      mapHttpError(response.status, redacted),
      response.status,
      isFatalApiError(redacted),
    )
  }

  if (!text || text === 'null') return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new GreenApiError('GREEN-API вернул непонятный ответ.')
  }
}

function endpoint(credentials: Credentials, methodPath: string, extraPath = ''): string {
  const [method, query] = methodPath.split('?')
  const tail = extraPath ? `/${extraPath}` : ''
  const suffix = query ? `?${query}` : ''
  return `${credentials.apiUrl}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}${tail}${suffix}`
}

function mapHttpError(status: number, body: string): string {
  const raw = extractMessage(body)
  const lower = raw.toLowerCase()

  if (lower.includes('webhook') || lower.includes('incomingwebhook')) {
    return INCOMING_DISABLED_MESSAGE
  }

  if (lower.includes('suspended')) {
    return 'Сейчас можно писать только тем, у кого ваш номер сохранён в контактах.'
  }

  if (lower.includes('4000')) {
    return 'Текст должен быть не длиннее 4000 символов.'
  }

  if (status === 404) {
    return 'Адрес API не найден. Скопируйте apiUrl из личного кабинета GREEN-API.'
  }

  if (status === 401 || lower.includes('not authorized')) {
    return 'Не удалось подключиться. Проверьте idInstance, токен и состояние инстанса.'
  }

  if (status === 403) {
    return 'Доступ запрещён. Проверьте токен и ограничения аккаунта.'
  }

  if (raw && looksUserFacing(raw)) return raw

  if (status >= 500) {
    return 'Сервис GREEN-API временно недоступен. Попробуйте ещё раз.'
  }

  return 'Не удалось выполнить запрос. Проверьте idInstance, токен и состояние подключения.'
}

function looksUserFacing(raw: string): boolean {
  return raw.length <= 180 && /[А-Яа-яЁё]/.test(raw) && !raw.startsWith('{') && !raw.startsWith('<')
}

function extractMessage(body: string): string {
  if (!body || body.startsWith('<')) return ''

  try {
    const parsed = JSON.parse(body) as unknown
    if (typeof parsed === 'string') return parsed
    if (!isRecord(parsed)) return body
    if (typeof parsed.message === 'string') return parsed.message
    if (typeof parsed.error === 'string') return parsed.error
    if (typeof parsed.description === 'string') return parsed.description
  } catch {
    return body
  }

  return body
}

function isFatalApiError(body: string): boolean {
  const lower = body.toLowerCase()
  return lower.includes('webhook') || lower.includes('incomingwebhook')
}

function redact(text: string, token: string): string {
  if (!token) return text
  return text.split(token).join('***')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
