import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { API_URL, authApi, boardsApi } from './api';

export interface ApiContextValue {
  apiUrl: string;
  auth: typeof authApi;
  boards: typeof boardsApi;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ApiContextValue>(
    () => ({ apiUrl: API_URL, auth: authApi, boards: boardsApi }),
    [],
  );
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const context = useContext(ApiContext);
  if (!context) throw new Error('useApi must be used inside <ApiProvider>');
  return context;
}
