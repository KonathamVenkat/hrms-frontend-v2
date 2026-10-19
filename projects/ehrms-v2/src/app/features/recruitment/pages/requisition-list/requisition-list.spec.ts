import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { RequisitionSummary } from '../../models/requisition.model';
import { RequisitionService } from '../../services/requisition.service';
import { RequisitionList } from './requisition-list';

const row = (id: number): RequisitionSummary => ({
  id,
  code: `REQ-2026-00000${id}`,
  jobTitle: `Role ${id}`,
  departmentId: 1,
  departmentName: 'Finance',
  requestedByName: 'Ayen Deng',
  noOfPositions: 2,
  filledPositions: 0,
  priority: 'HIGH',
  status: 'DRAFT',
});

const page = (content: RequisitionSummary[]) => ({
  success: true,
  message: '',
  statusCode: 200,
  data: {
    content,
    totalElements: content.length,
    totalPages: 1,
    size: 20,
    number: 0,
    first: true,
    last: true,
  },
});

function setup(
  opts: { search?: ReturnType<typeof vi.fn>; departments?: { id: number; name: string }[] } = {},
) {
  const svc = {
    search: opts.search ?? vi.fn(() => of(page([row(1), row(2)]))),
    raiseOptions: vi.fn(() =>
      of({
        success: true,
        message: '',
        statusCode: 200,
        data: {
          departments: opts.departments ?? [{ id: 1, name: 'Finance' }],
          designations: [],
          locations: [],
        },
      }),
    ),
  };
  TestBed.configureTestingModule({
    imports: [RequisitionList, NoopAnimationsModule],
    providers: [
      provideTranslateService(),
      provideRouter([]),
      { provide: RequisitionService, useValue: svc },
    ],
  });
  const fixture = TestBed.createComponent(RequisitionList);
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    svc,
    el: fixture.nativeElement as HTMLElement,
  };
}

describe('RequisitionList', () => {
  afterEach(() => vi.useRealTimers());

  it('loads the first page and lists the requisitions with a link to each', () => {
    const { el, svc } = setup();
    expect(svc.search).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 20, sortBy: 'createdAt', direction: 'desc' }),
    );
    expect(el.querySelectorAll('tr[mat-row]').length).toBe(2);
    expect(el.querySelector('a.ref-id')?.getAttribute('href')).toBe(
      '/app/recruitment/requisitions/1',
    );
  });

  it('shows the empty state with a next step when there is nothing yet', () => {
    const { el } = setup({ search: vi.fn(() => of(page([]))) });
    expect(el.querySelector('.empty-state')?.textContent).toContain('recruitment.list.empty');
    expect(el.textContent).toContain('recruitment.list.emptyHint');
  });

  it('shows an error with a retry, and the retry asks again', () => {
    const search = vi.fn(() => throwError(() => ({ status: 0 })));
    const { el, component } = setup({ search });
    expect(el.querySelector('.alert-error')?.textContent).toContain('common.httpErrors.offline');
    expect(el.querySelector('tr[mat-row]')).toBeNull();
    component.retry();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('offers "New requisition" only to someone who may raise one', () => {
    expect(setup().el.querySelector('a[href="/app/recruitment/requisitions/new"]')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(
      setup({ departments: [] }).el.querySelector('a[href="/app/recruitment/requisitions/new"]'),
    ).toBeNull();
  });

  it('searches after a pause in typing, from the first page', () => {
    vi.useFakeTimers();
    const { component, svc } = setup();
    component.page.set(3);
    svc.search.mockClear();

    component.filterForm.controls.q.setValue('analyst');
    vi.advanceTimersByTime(299);
    expect(svc.search).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(svc.search).toHaveBeenCalledTimes(1);
    expect(svc.search).toHaveBeenCalledWith(expect.objectContaining({ q: 'analyst', page: 0 }));
  });

  it('applies a status filter at once and says so when nothing matches', () => {
    const search = vi.fn(() => of(page([])));
    const { fixture, component, el, svc } = setup({ search });
    svc.search.mockClear();
    component.filterForm.controls.status.setValue('APPROVED');
    fixture.detectChanges();
    expect(svc.search).toHaveBeenCalledWith(expect.objectContaining({ status: 'APPROVED' }));
    expect(component.hasFilters()).toBe(true);
    expect(el.querySelector('.empty-state')?.textContent).toContain(
      'recruitment.list.emptyFiltered',
    );
  });

  it('clears the filters back to everything', () => {
    const { component, svc } = setup();
    component.filterForm.controls.status.setValue('DRAFT');
    svc.search.mockClear();
    component.clearFilters();
    expect(svc.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: undefined, departmentId: undefined }),
    );
    expect(component.hasFilters()).toBe(false);
  });
});
