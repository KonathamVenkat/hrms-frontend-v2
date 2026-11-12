import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

/** The five masters that only SYSTEM_ADMIN may maintain (the API answers 403 to everyone else). */
const SYSTEM_ADMIN_ONLY = [
  'leave-types',
  'holiday-calendar',
  'work-shifts',
  'office-locations',
  'document-types',
];

describe('app routes', () => {
  const admin = routes.flatMap((r) => r.children ?? []).find((r) => r.path === 'admin');

  it('guards each SYSTEM_ADMIN-only master screen on its own route', () => {
    expect(admin?.children).toBeDefined();
    for (const path of SYSTEM_ADMIN_ONLY) {
      const route = admin?.children?.find((r) => r.path === path);
      expect(route, path).toBeDefined();
      expect(route?.canActivate?.length, path).toBe(1);
    }
  });
});
