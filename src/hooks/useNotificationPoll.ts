import { useEffect } from 'react'
import type { Credentials } from '../types/api.ts'
import type { ApplyResult } from '../services/applyNotification.ts'
import {
  asGreenApiError,
  deleteNotification,
  INCOMING_DISABLED_MESSAGE,
  incomingNotificationsAvailable,
  isAbortError,
  receiveNotification,
} from '../services/greenApiService.ts'

const NOTIFICATION_GAP_MS = 400
const MAX_STATUS_HOLDS = 15

export function useNotificationPoll(
  credentials: Credentials,
  onNotification: (body: unknown) => ApplyResult,
  onError: (message: string | null) => void,
) {
  useEffect(() => {
    const controller = new AbortController()
    let stopped = false

    const run = async () => {
      let delayMs = 0
      let heldReceiptId: number | null = null
      let heldCount = 0

      try {
        const available = await incomingNotificationsAvailable(credentials, controller.signal)
        if (stopped) return
        if (!available) {
          onError(INCOMING_DISABLED_MESSAGE)
          return
        }
      } catch (error) {
        if (stopped || isAbortError(error)) return
        const apiError = asGreenApiError(error)
        onError(apiError.message)
        if (apiError.fatal) return
      }

      while (!stopped) {
        if (delayMs > 0) {
          try {
            await wait(delayMs, controller.signal)
          } catch {
            return
          }
        }

        try {
          const notification = await receiveNotification(credentials, controller.signal)
          if (stopped) return

          if (!notification) {
            onError(null)
            heldReceiptId = null
            heldCount = 0
            delayMs = 0
            continue
          }

          const result = onNotification(notification.body)
          if (result.ack) {
            await deleteNotification(credentials, notification.receiptId, controller.signal)
            if (stopped) return
            onError(null)
            heldReceiptId = null
            heldCount = 0
            delayMs = NOTIFICATION_GAP_MS
            continue
          }

          if (result.hold) {
            heldCount = heldReceiptId === notification.receiptId ? heldCount + 1 : 1
            heldReceiptId = notification.receiptId
            if (heldCount >= MAX_STATUS_HOLDS) {
              onError('Статус сообщения пришёл раньше самого сообщения и так и не совпал. Получение остановлено, уведомление в очереди осталось.')
              return
            }
            delayMs = NOTIFICATION_GAP_MS
            continue
          }

          onError(result.reason ?? 'Уведомление не обработано. Получение остановлено, из очереди оно не удалено.')
          return
        } catch (error) {
          if (stopped || isAbortError(error)) return
          const apiError = asGreenApiError(error)
          onError(apiError.message)
          if (apiError.fatal) return
          delayMs = delayMs > NOTIFICATION_GAP_MS ? Math.min(delayMs * 2, 15_000) : 2_000
        }
      }
    }

    void run()

    return () => {
      stopped = true
      controller.abort()
    }
  }, [credentials, onNotification, onError])
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}
