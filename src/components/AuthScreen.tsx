import { useState, type FormEvent } from 'react'
import type { Credentials } from '../types/api.ts'
import { asGreenApiError, connect, normalizeCredentials } from '../services/greenApiService.ts'

interface AuthScreenProps {
  onSuccess: (credentials: Credentials, warning: string | null) => void
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [apiUrl, setApiUrl] = useState('')
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const credentials = normalizeCredentials({ apiUrl, idInstance, apiTokenInstance })
      const warning = await connect(credentials)
      onSuccess(credentials, warning)
    } catch (caught) {
      setError(asGreenApiError(caught).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={handleSubmit} autoComplete="off">
        <h1>Чаты</h1>
        <p className="lead">Введите данные инстанса из личного кабинета GREEN-API.</p>

        <label>
          Адрес API
          <input
            name="apiUrl"
            inputMode="url"
            placeholder="https://3100.api.green-api.com"
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            disabled={loading}
            required
          />
        </label>

        <label>
          idInstance
          <input
            name="idInstance"
            inputMode="numeric"
            autoComplete="off"
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value)}
            disabled={loading}
            required
          />
        </label>

        <div className="field">
          <label htmlFor="api-token">apiTokenInstance</label>
          <div className="token-row">
            <input
              id="api-token"
              name="apiTokenInstance"
              type={showToken ? 'text' : 'password'}
              autoComplete="off"
              value={apiTokenInstance}
              onChange={(event) => setApiTokenInstance(event.target.value)}
              disabled={loading}
              required
            />
            <button
              type="button"
              className="ghost"
              onClick={() => setShowToken((current) => !current)}
              disabled={loading}
            >
              {showToken ? 'Скрыть' : 'Показать'}
            </button>
          </div>
        </div>

        {error ? <p className="banner" role="alert">{error}</p> : null}

        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Проверяем…' : 'Войти'}
        </button>

        <p className="hint">
          Адрес, idInstance и токен копируются из кабинета. Чтобы приходили ответы,
          очистите там webhook URL и включите входящие уведомления.
        </p>
      </form>
    </main>
  )
}
