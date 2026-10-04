import { useEffect, useState } from 'react'
import { AuthScreen } from './components/AuthScreen.tsx'
import { Messenger } from './components/Messenger.tsx'
import type { Credentials } from './types/api.ts'
import { clearPendingStatuses } from './services/applyNotification.ts'
import { clearSession, forgetStoredCredentials } from './utils/sessionStore.ts'

export default function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    forgetStoredCredentials()
  }, [])

  if (!credentials) {
    return (
      <AuthScreen
        onSuccess={(next, nextWarning) => {
          setWarning(nextWarning)
          setCredentials(next)
        }}
      />
    )
  }

  return (
    <Messenger
      credentials={credentials}
      warning={warning}
      onLogout={() => {
        clearPendingStatuses()
        clearSession()
        setWarning(null)
        setCredentials(null)
      }}
    />
  )
}
