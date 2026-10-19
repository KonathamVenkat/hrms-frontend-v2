import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  function run(unsaved: boolean, answer: boolean) {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(answer);
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (k: string) => k } }],
    });
    const screen: HasUnsavedChanges = { hasUnsavedChanges: () => unsaved };
    const result = TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(screen, route, state, state),
    );
    return { result, confirm };
  }

  afterEach(() => vi.restoreAllMocks());

  it('lets the user leave without asking when nothing is unsaved', () => {
    const { result, confirm } = run(false, false);
    expect(result).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before leaving with unsaved edits, and stays when the user says no', () => {
    const { result, confirm } = run(true, false);
    expect(confirm).toHaveBeenCalledWith('common.unsavedChanges');
    expect(result).toBe(false);
  });

  it('leaves when the user confirms', () => {
    expect(run(true, true).result).toBe(true);
  });
});
