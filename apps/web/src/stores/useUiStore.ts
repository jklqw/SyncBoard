import { create } from 'zustand';

export type SyncStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';
export type ModalName = 'share' | 'create' | 'history' | 'comments' | null;

const DARK_KEY = 'syncboard.theme';

function initialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(DARK_KEY) === 'dark' ? 'dark' : 'light';
}

interface UiState {
  theme: 'light' | 'dark';
  syncStatus: SyncStatus;
  modal: ModalName;
  presenting: boolean;
  followingName: string | null;
  toast: string | null;
  commentDraft: { x: number; y: number; elementId: string | null } | null;
  toggleTheme: () => void;
  setSyncStatus: (status: SyncStatus) => void;
  openModal: (modal: Exclude<ModalName, null>) => void;
  closeModal: () => void;
  setPresenting: (presenting: boolean) => void;
  setFollowingName: (name: string | null) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  setCommentDraft: (draft: UiState['commentDraft']) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: initialTheme(),
  syncStatus: 'connecting',
  modal: null,
  presenting: false,
  followingName: null,
  toast: null,
  commentDraft: null,

  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') window.localStorage.setItem(DARK_KEY, theme);
      document.documentElement.dataset['theme'] = theme;
      return { theme };
    }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
  setPresenting: (presenting) => set({ presenting }),
  setFollowingName: (followingName) => set({ followingName }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
  setCommentDraft: (commentDraft) => set({ commentDraft }),
}));

export function applyStoredTheme(): void {
  const theme = useUiStore.getState().theme;
  document.documentElement.dataset['theme'] = theme;
}
