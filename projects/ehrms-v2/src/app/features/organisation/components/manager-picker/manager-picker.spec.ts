import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ManagerPicker, PickedManager } from './manager-picker';
import { OrganisationService } from '../../services/organisation.service';
import { EmployeeBranchGap, PagedResponse } from '../../models/organisation.model';

const lual: EmployeeBranchGap = {
  employeeId: 5,
  employeeCode: 'EMP-2026-000005',
  fullName: 'Lual Deng',
  fullNameAr: 'ل د',
  departmentName: 'Finance',
  locationId: 7,
  locationName: 'Juba HQ',
};
const page = (
  content: EmployeeBranchGap[],
  totalElements = content.length,
): PagedResponse<EmployeeBranchGap> => ({
  content,
  totalPages: 1,
  totalElements,
  size: 50,
  number: 0,
  first: true,
  last: true,
});

function setup(managerCandidates: ReturnType<typeof vi.fn>, locationId: number | null = 7) {
  TestBed.configureTestingModule({
    imports: [ManagerPicker],
    providers: [
      provideTranslateService(),
      { provide: OrganisationService, useValue: { managerCandidates } },
    ],
  });
  const fixture = TestBed.createComponent(ManagerPicker);
  fixture.componentRef.setInput('locationId', locationId);
  fixture.detectChanges();
  const picked: (PickedManager | null)[] = [];
  fixture.componentInstance.picked.subscribe((p) => picked.push(p));
  return { fixture, picked, el: fixture.nativeElement as HTMLElement };
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  await vi.advanceTimersByTimeAsync(300);
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('ManagerPicker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows loading first, then the employees of the location', async () => {
    const list = vi.fn(() => of(page([lual])));
    const { fixture, el } = setup(list);
    expect(el.querySelector('[role="status"]')).not.toBeNull();

    await settle(fixture);

    expect(list).toHaveBeenCalledWith(7, '', 0, 50);
    expect(el.querySelectorAll('.mp-option').length).toBe(1);
    expect(el.querySelector('.mp-option')?.textContent).toContain('Lual Deng');
    expect(el.querySelector('.mp-option')?.textContent).toContain('Finance');
  });

  it('says so when nobody works at the location, and offers everyone via the switch', async () => {
    const list = vi.fn((loc: number | null) => of(page(loc === null ? [lual] : [])));
    const { fixture, el } = setup(list);
    await settle(fixture);
    expect(el.querySelector('.mp-option')).toBeNull();
    expect(el.querySelector('.mp-status')?.textContent).toContain(
      'organisation.managerPicker.emptyHere',
    );

    (el.querySelector('.mp-switch input') as HTMLInputElement).click();
    await settle(fixture);

    expect(list).toHaveBeenLastCalledWith(null, '', 0, 50);
    expect(el.querySelectorAll('.mp-option').length).toBe(1);
  });

  it('has no switch when the branch has no location, and lists everyone', async () => {
    const list = vi.fn(() => of(page([lual])));
    const { fixture, el } = setup(list, null);
    await settle(fixture);

    expect(el.querySelector('.mp-switch')).toBeNull();
    expect(list).toHaveBeenCalledWith(null, '', 0, 50);
  });

  it('searches after a pause, not on every keystroke', async () => {
    const list = vi.fn(() => of(page([lual])));
    const { fixture, el } = setup(list);
    await settle(fixture);
    list.mockClear();

    const input = el.querySelector('.mp-search') as HTMLInputElement;
    input.value = 'l';
    input.dispatchEvent(new Event('input'));
    input.value = 'lu';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);

    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith(7, 'lu', 0, 50);
  });

  it('tells the user when the list is cut short', async () => {
    const { fixture, el } = setup(vi.fn(() => of(page([lual], 120))));
    await settle(fixture);

    expect(el.textContent).toContain('organisation.managerPicker.more');
  });

  it('emits the chosen employee with the name to show, and marks it selected', async () => {
    const { fixture, picked, el } = setup(vi.fn(() => of(page([lual]))));
    await settle(fixture);

    (el.querySelector('.mp-option') as HTMLButtonElement).click();
    expect(picked).toEqual([{ id: 5, label: 'Lual Deng' }]);

    fixture.componentRef.setInput('selectedId', 5);
    fixture.componentRef.setInput('selectedLabel', 'Lual Deng');
    fixture.detectChanges();
    expect(el.querySelector('.mp-option')?.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.mp-current')?.textContent).toContain('Lual Deng');
  });

  it('emits null when the manager is removed', async () => {
    const { fixture, picked, el } = setup(vi.fn(() => of(page([lual]))));
    fixture.componentRef.setInput('selectedId', 5);
    fixture.componentRef.setInput('selectedLabel', 'Lual Deng');
    await settle(fixture);

    (el.querySelector('.mp-current button') as HTMLButtonElement).click();

    expect(picked).toEqual([null]);
  });

  it('shows an error with a retry that loads again', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of(page([lual])));
    const { fixture, el } = setup(list);
    await settle(fixture);
    expect(el.querySelector('[role="alert"]')).not.toBeNull();

    (el.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await settle(fixture);

    expect(list).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('.mp-option').length).toBe(1);
  });
});
