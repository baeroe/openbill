import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePref = 'system' | 'light' | 'dark'

interface UiState {
  theme: ThemePref
  signedIn: boolean
  sidebarCollapsed: boolean
  previewOpen: boolean
  showGuides: boolean
  setTheme(t: ThemePref): void
  signIn(): void
  signOut(): void
  toggleSidebar(): void
  togglePreview(): void
  toggleGuides(): void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      signedIn: false,
      sidebarCollapsed: false,
      previewOpen: true,
      showGuides: false,
      setTheme: (theme) => set({ theme }),
      signIn: () => set({ signedIn: true }),
      signOut: () => set({ signedIn: false }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      togglePreview: () => set((s) => ({ previewOpen: !s.previewOpen })),
      toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
    }),
    { name: 'openbill:ui' },
  ),
)
