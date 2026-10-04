import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  GreenApiError,
  incomingNotificationsAvailable,
  normalizeCredentials,
} from './greenApiService.ts'

const credentials = {
  apiUrl: 'https://3100.api.green-api.com',
  idInstance: '1234567890',
  apiTokenInstance: 'exampletoken',
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('учётные данные', () => {
  it('не принимает короткий токен', () => {
    assert.throws(
      () => normalizeCredentials({ ...credentials, apiTokenInstance: 'short' }),
      (error: unknown) => error instanceof GreenApiError && error.message.includes('apiTokenInstance'),
    )
  })

  it('не принимает idInstance с буквами', () => {
    assert.throws(
      () => normalizeCredentials({ ...credentials, idInstance: 'abc12345' }),
      (error: unknown) => error instanceof GreenApiError,
    )
  })
})

describe('входящие уведомления', () => {
  it('считает получение выключенным, если incomingWebhook равен no', async () => {
    globalThis.fetch = async () => Response.json({ incomingWebhook: 'no', webhookUrl: '' })
    assert.equal(await incomingNotificationsAvailable(credentials), false)
  })

  it('считает получение выключенным, если задан webhook URL', async () => {
    globalThis.fetch = async () => Response.json({
      incomingWebhook: 'yes',
      webhookUrl: 'https://example.com/hook',
    })
    assert.equal(await incomingNotificationsAvailable(credentials), false)
  })
})
