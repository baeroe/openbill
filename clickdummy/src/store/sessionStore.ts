import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'system' | 'light' | 'dark'
interface SessionState {
  user: { name: string; email: string } | null
  theme: Theme
  login(email: string): void
  logout(): void
  setTheme(t: Theme): void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      theme: 'system',
      login: (email) => set({ user: { name: 'Mara Lindqvist', email: email || 'mara@nordlicht.example' } }),
      logout: () => set({ user: null }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'openbill:session', version: 1, partialize: (s) => ({ user: s.user, theme: s.theme }) },
  ),
)
