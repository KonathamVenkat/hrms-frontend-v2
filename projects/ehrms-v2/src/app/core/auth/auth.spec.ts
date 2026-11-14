import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Auth, LoginResponse, SIDEBAR_MENU_CACHE_KEY, StoredUser } from './auth';

function login(role: string, fullName = 'Akol Mayen'): LoginResponse {
  const user: StoredUser = { id: 1, username: 'akol', email: 'a@example.test', fullName, role };
  return { accessToken: 'token-' + role, tokenType: 'Bearer', expiresIn: 1800, user };
}

describe('Auth.renewToken', () => {
  let auth: Auth;

  beforeEach(() => {
    sessionStorage.clear();
    auth = TestBed.inject(Auth);
    auth.clearSession();
    auth.saveSession(login('EMPLOYEE'));
    sessionStorage.setItem(SIDEBAR_MENU_CACHE_KEY, '[]');
  });

  it('takes the new token and the user object from the refresh response', () => {
    auth.renewToken(login('EMPLOYEE', 'Akol A. Mayen'));
    expect(auth.getToken()).toBe('token-EMPLOYEE');
    expect(auth.getStoredUser()?.fullName).toBe('Akol A. Mayen');
  });

  it('keeps the cached menu when the role is unchanged', () => {
    auth.renewToken(login('EMPLOYEE'));
    expect(sessionStorage.getItem(SIDEBAR_MENU_CACHE_KEY)).toBe('[]');
  });

  it('drops the cached menu when the role changed', () => {
    auth.renewToken(login('HR_MANAGER'));
    expect(auth.getStoredUser()?.role).toBe('HR_MANAGER');
    expect(sessionStorage.getItem(SIDEBAR_MENU_CACHE_KEY)).toBeNull();
  });
});
