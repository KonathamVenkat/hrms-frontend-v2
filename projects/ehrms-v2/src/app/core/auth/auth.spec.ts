import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Auth, LoginResponse, SIDEBAR_MENU_CACHE_KEY, StoredUser } from './auth';

function login(role: string, fullName = 'Akol Mayen', id = 1): LoginResponse {
  const user: StoredUser = { id, username: 'akol', email: 'a@example.test', fullName, role };
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

  it('says it renewed the session', () => {
    expect(auth.renewToken(login('EMPLOYEE'))).toBe(true);
  });

  it('does not bring a signed-out session back when a late refresh arrives', () => {
    auth.clearSession();
    expect(auth.renewToken(login('EMPLOYEE'))).toBe(false);
    expect(auth.getToken()).toBeNull();
    expect(auth.getStoredUser()).toBeNull();
  });

  it('does not adopt a refresh that belongs to another user, and ends this session instead', () => {
    expect(auth.renewToken(login('EMPLOYEE', 'Someone Else', 2))).toBe(false);
    expect(auth.getToken()).toBeNull();
    expect(auth.getStoredUser()).toBeNull();
    expect(sessionStorage.getItem(SIDEBAR_MENU_CACHE_KEY)).toBeNull();
  });
});

describe('Auth.sessionCleared$', () => {
  it('tells listeners each time the session is cleared, including by a new sign-in', () => {
    const auth = TestBed.inject(Auth);
    let cleared = 0;
    const sub = auth.sessionCleared$.subscribe(() => cleared++);

    auth.clearSession();
    expect(cleared).toBe(1);

    auth.saveSession(login('EMPLOYEE')); // a new sign-in starts from a cleared session
    expect(cleared).toBe(2);
    sub.unsubscribe();
  });
});
