import type { LoginInput, RegisterInput } from '@syncboard/shared';
import { apiFetch, setAccessToken } from './client';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export const authApi = {
  async register(input: RegisterInput): Promise<AuthUser> {
    const result = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
      skipRefresh: true,
    });
    setAccessToken(result.accessToken);
    return result.user;
  },

  async login(input: LoginInput): Promise<AuthUser> {
    const result = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
      skipRefresh: true,
    });
    setAccessToken(result.accessToken);
    return result.user;
  },

  async me(): Promise<AuthUser> {
    return apiFetch<AuthUser>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
    }
  },
};
