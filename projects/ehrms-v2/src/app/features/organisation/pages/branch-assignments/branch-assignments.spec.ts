import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { BranchAssignments } from './branch-assignments';
import { OrganisationService } from '../../services/organisation.service';
import {
  BranchAssignmentResult,
  BranchLookup,
  EmployeeBranchGap,
  OrganisationSummary,
  PagedResponse,
} from '../../models/organisation.model';

const summary: OrganisationSummary = {
  employeesWithoutBranch: 12,
  branchesWithoutManager: 3,
  branchesWithoutLocation: 2,
};
const branches: BranchLookup[] = [
  { id: 1, nameEn: 'Juba', nameAr: 'جوبا', locationId: 7 },
  { id: 2, nameEn: 'Wau', nameAr: 'واو', locationId: 8 },
];
const lual: EmployeeBranchGap = {
  employeeId: 11,
  employeeCode: 'EMP-2026-000011',
  fullName: 'Lual Deng',
  fullNameAr: 'ع',
  locationId: 7,
};
const achol: EmployeeBranchGap = {
  employeeId: 12,
  employeeCode: 'EMP-2026-000012',
  fullName: 'Achol Mayen',
  fullNameAr: 'ع',
  locationId: 8,
};

const pageOf = (
  content: EmployeeBranchGap[],
  number = 0,
  totalPages = 1,
): PagedResponse<EmployeeBranchGap> => ({
  content,
  totalPages,
  totalElements: content.length,
  size: 20,
  number,
  first: number === 0,
  last: number === totalPages - 1,
});

interface Calls {
  summary: ReturnType<typeof vi.fn>;
  lookupBranches: ReturnType<typeof vi.fn>;
  employeesWithoutBranch: ReturnType<typeof vi.fn>;
  assignBranches: ReturnType<typeof vi.fn>;
}

function setup(over: Partial<Calls> = {}) {
  const svc: Calls = {
    summary: vi.fn(() => of(summary)),
    lookupBranches: vi.fn(() => of(branches)),
    employeesWithoutBranch: vi.fn(() => of(pageOf([lual, achol]))),
    assignBranches: vi.fn(() => of({ assigned: 2, skipped: [] } as BranchAssignmentResult)),
    ...over,
  };
  TestBed.configureTestingModule({
    imports: [BranchAssignments],
    providers: [provideTranslateService(), { provide: OrganisationService, useValue: svc }],
  });
  // One real text, so the test can see that the dialog is told the count.
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', {
    organisation: { branchAssignments: { confirmBody: 'Assign {{count}} employees now' } },
  });
  translate.use('en');
  const fixture = TestBed.createComponent(BranchAssignments);
  fixture.detectChanges();
  return { fixture, svc, el: fixture.nativeElement as HTMLElement };
}

const click = (el: Element | null) => (el as HTMLElement).click();
const choose = (el: HTMLElement, row: number, value: string) => {
  const select = el.querySelectorAll('tbody tr')[row].querySelector('select') as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change'));
};

describe('BranchAssignments', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the three gap counts as tiles', () => {
    const { el } = setup();

    const tiles = Array.from(el.querySelectorAll('.stat-tile')).map((t) => t.textContent);
    expect(tiles.join('|')).toContain('12');
    expect(tiles.join('|')).toContain('3');
    expect(tiles.join('|')).toContain('2');
  });

  it('loads the first page from the server and asks for the next one on demand', () => {
    const { fixture, svc, el } = setup({
      employeesWithoutBranch: vi.fn(() => of(pageOf([lual, achol], 0, 3))),
    });

    expect(svc.employeesWithoutBranch).toHaveBeenCalledWith('', 0, 20);
    click(el.querySelector('[data-testid="next"]'));
    fixture.detectChanges();
    expect(svc.employeesWithoutBranch).toHaveBeenLastCalledWith('', 1, 20);
  });

  it('debounces the search by 300 ms', () => {
    vi.useFakeTimers();
    const { fixture, svc, el } = setup();
    svc.employeesWithoutBranch.mockClear();

    const input = el.querySelector('input[type="search"], input[type="text"]') as HTMLInputElement;
    input.value = 'lual';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(299);
    expect(svc.employeesWithoutBranch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(svc.employeesWithoutBranch).toHaveBeenCalledWith('lual', 0, 20);
  });

  it('shows the empty state when nobody is missing a branch', () => {
    const { el } = setup({ employeesWithoutBranch: vi.fn(() => of(pageOf([]))) });

    expect(el.querySelector('.empty-card')).not.toBeNull();
    expect(el.querySelector('table')).toBeNull();
  });

  it('shows an error with a retry button when the list cannot be loaded', () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of(pageOf([lual])));
    const { fixture, el } = setup({ employeesWithoutBranch: list });

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    click(el.querySelector('[data-testid="retry"]'));
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it("offers only the branches of the employee's own location", () => {
    const { el } = setup();

    const optionsOf = (row: number) =>
      Array.from(el.querySelectorAll('tbody tr')[row].querySelectorAll('option')).map((o) =>
        o.textContent?.trim(),
      );
    expect(optionsOf(0).join('|')).toContain('Juba');
    expect(optionsOf(0).join('|')).not.toContain('Wau');
    expect(optionsOf(1).join('|')).toContain('Wau');
    expect(optionsOf(1).join('|')).not.toContain('Juba');
  });

  it('keeps the assign button disabled until a branch is chosen', () => {
    const { fixture, el } = setup();
    const button = () => el.querySelector('[data-testid="assign"]') as HTMLButtonElement;

    expect(button().disabled).toBe(true);
    choose(el, 0, '1');
    fixture.detectChanges();
    expect(button().disabled).toBe(false);
  });

  it('asks for confirmation naming the count, then assigns once even on a double click', () => {
    const pending = new Subject<BranchAssignmentResult>();
    const { fixture, svc, el } = setup({ assignBranches: vi.fn(() => pending) });
    choose(el, 0, '1');
    choose(el, 1, '2');
    fixture.detectChanges();

    click(el.querySelector('[data-testid="assign"]'));
    fixture.detectChanges();
    expect(el.querySelector('.confirm-dialog')?.textContent).toContain('Assign 2 employees now');
    expect(svc.assignBranches).not.toHaveBeenCalled();

    click(el.querySelector('[data-testid="confirm"]'));
    fixture.componentInstance.confirmAssign();
    fixture.detectChanges();
    expect(svc.assignBranches).toHaveBeenCalledTimes(1);
    expect(svc.assignBranches).toHaveBeenCalledWith([
      { employeeId: 11, branchId: 1 },
      { employeeId: 12, branchId: 2 },
    ]);
  });

  it('lists the skipped rows with their reason, refreshes the list and the summary', () => {
    const result: BranchAssignmentResult = {
      assigned: 1,
      skipped: [{ employeeId: 12, reason: 'BRANCH_INACTIVE' }],
    };
    const { fixture, svc, el } = setup({ assignBranches: vi.fn(() => of(result)) });
    choose(el, 0, '1');
    choose(el, 1, '2');
    fixture.detectChanges();
    click(el.querySelector('[data-testid="assign"]'));
    fixture.detectChanges();
    svc.employeesWithoutBranch.mockClear();
    svc.summary.mockClear();

    click(el.querySelector('[data-testid="confirm"]'));
    fixture.detectChanges();

    const skipped = el.querySelector('[data-testid="skipped"]');
    expect(skipped?.textContent).toContain('Achol Mayen');
    expect(skipped?.textContent).toContain('BRANCH_INACTIVE');
    expect(svc.employeesWithoutBranch).toHaveBeenCalledTimes(1);
    expect(svc.summary).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.confirm-dialog')).toBeNull();
  });
});
