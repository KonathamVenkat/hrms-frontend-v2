import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { RECRUITMENT_ROUTES } from './recruitment-routing';

describe('RECRUITMENT_ROUTES requisitions guard', () => {
  function allows(role: string): boolean {
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { hasAnyRole: (...roles: string[]) => roles.includes(role) } },
        { provide: Router, useValue: { createUrlTree: () => 'dashboard' } },
      ],
    });
    const route = RECRUITMENT_ROUTES.find((r) => r.path === 'requisitions');
    const guard = route?.canActivate?.[0];
    const result = TestBed.runInInjectionContext(() =>
      (guard as (r: ActivatedRouteSnapshot, s: RouterStateSnapshot) => unknown)(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    return result === true;
  }

  it.each(['HR_ADMIN', 'HR_MANAGER', 'EMPLOYEE', 'GENERAL_MANAGER'])('lets %s in', (role) => {
    expect(allows(role)).toBe(true);
  });

  it('keeps SYSTEM_ADMIN out', () => {
    expect(allows('SYSTEM_ADMIN')).toBe(false);
  });
});
