import { useEffect, useState } from 'react'

type DbStatus = { state: 'loading' } | { state: 'ok'; schema: string } | { state: 'error'; error: string }

export function App() {
  const [db, setDb] = useState<DbStatus>({ state: 'loading' })

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<{ ok: boolean; db?: { schema: string }; error?: string }>)
      .then((body) =>
        setDb(
          body.ok && body.db
            ? { state: 'ok', schema: body.db.schema }
            : { state: 'error', error: body.error ?? 'unknown error' },
        ),
      )
      .catch((err: unknown) => setDb({ state: 'error', error: String(err) }))
  }, [])

  return (
    <main className="hello">
      <h1 data-testid="app-title">Neon Cards</h1>
      <p data-testid="db-status" data-state={db.state}>
        {db.state === 'loading' && 'Checking database…'}
        {db.state === 'ok' && `D1 ok · schema ${db.schema}`}
        {db.state === 'error' && `D1 error · ${db.error}`}
      </p>
    </main>
  )
}
