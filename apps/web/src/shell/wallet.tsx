import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'

export type WalletState = { status: 'loading' } | { status: 'ok'; balance: number } | { status: 'error' }

interface WalletApi {
  wallet: WalletState
  setBalance(balance: number): void
  refresh(): void
}

const WalletContext = createContext<WalletApi | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({ status: 'loading' })
  const refresh = useCallback(() => {
    api.wallet().then(
      ({ balance }) => setWallet({ status: 'ok', balance }),
      () => setWallet({ status: 'error' }),
    )
  }, [])
  useEffect(refresh, [refresh])
  const value = useMemo(
    () => ({ wallet, refresh, setBalance: (balance: number) => setWallet({ status: 'ok', balance }) }),
    [wallet, refresh],
  )
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletApi {
  const value = useContext(WalletContext)
  if (!value) throw new Error('useWallet outside WalletProvider')
  return value
}

export const formatChips = (amount: number) => `$${amount.toLocaleString('en-US')}`

export function WalletPill() {
  const { wallet } = useWallet()
  return (
    <div className="pill wallet" data-testid="wallet" data-state={wallet.status}>
      {wallet.status === 'ok' ? formatChips(wallet.balance) : wallet.status === 'loading' ? '$…' : '$—'}
    </div>
  )
}
