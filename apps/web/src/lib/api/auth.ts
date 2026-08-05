import type { AuthResponse } from '@threads-clone/shared-types';

import type { LoginInput, RegisterInput } from './auth.types';
import { apiFetch } from './client';

export function registerUser(data: RegisterInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: data });
}

export function loginUser(data: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: data });
}

export function fetchCurrentUser(): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/me');
}

export function logoutUser(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}
