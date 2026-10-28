import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';

import { LanguageService } from '../../../../core/services/language.service';
import { ApiResponse, InboxItem, PagedResponse } from '../../models/workflow.model';
import { WorkflowService } from '../../services/workflow.service';
import { ApprovalsInbox } from './approvals-inbox';

const item = (id: number, name = 'Ayen Deng'): InboxItem => ({
  type: 'LEAVE',
  requestId: id,
  stepKey: 'HEAD',
  stepLabelEn: 'Department head',
  stepLabelAr: 'رئيس القسم',
  requesterEmployeeId: 40 + id,
  requesterName: name,
  summary: 'Annual 2026-11-01 to 2026-11-05 (5 days)',
  submittedAt: '2026-10-25T09:00:00',
});

function page(items: InboxItem[], total = items.length): ApiResponse<PagedResponse<InboxItem>> {
  return {
    success: true,
    message: '',
    statusCode: 200,
    data: { content: items, totalElements: total, totalPages: 1, number: 0, size: 10 },
  };
}

function setup(inbox: (p: number, s: number) => Observable<ApiResponse<PagedResponse<InboxItem>>>) {
  const svc = { inbox: vi.fn(inbox) };
  TestBed.configureTestingModule({
    imports: [ApprovalsInbox, NoopAnimationsModule],
    providers: [
      provideTranslateService(),
      provideRouter([]),
      { provide: WorkflowService, useValue: svc },
      { provide: LanguageService, useValue: { currentLang: () => 'en' } },
    ],
  });
  const fixture = TestBed.createComponent(ApprovalsInbox);
  fixture.detectChanges();
  return { fixture, svc, el: fixture.nativeElement as HTMLElement, cmp: fixture.componentInstance };
}

describe('ApprovalsInbox', () => {
  it('shows a loading state until the first page arrives', () => {
    const pending = new Subject<ApiResponse<PagedResponse<InboxItem>>>();
    const { fixture, el } = setup(() => pending);
    expect(el.querySelector('.center-spinner')).not.toBeNull();
    pending.next(page([item(1)]));
    fixture.detectChanges();
    expect(el.querySelector('.center-spinner')).toBeNull();
  });

  it('shows the empty state for zero rows', () => {
    const { el } = setup(() => of(page([])));
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('workflow.inbox.empty');
  });

  it('shows an error with a retry that loads again', () => {
    let fail = true;
    const { fixture, el, svc } = setup(() =>
      fail ? throwError(() => ({ status: 500 })) : of(page([item(1)])),
    );
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    fail = false;
    el.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    fixture.detectChanges();
    expect(svc.inbox).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('lists the requests with an Arabic requester name and links to the detail page', () => {
    const { el } = setup(() => of(page([item(1, 'أيين دينق'), item(2)])));
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('أيين دينق');
    expect(rows[0].querySelector('td[dir="auto"]')).not.toBeNull();
    const link = rows[0].querySelector('a');
    expect(link?.getAttribute('href')).toBe('/app/workflow/requests/LEAVE/1');
  });

  it('never leaves the link empty when the requester name is missing', () => {
    const bare: InboxItem = { ...item(3), requesterName: undefined, summary: undefined };
    const { el } = setup(() => of(page([bare])));
    const link = el.querySelector('tbody tr a');
    expect(link?.textContent).toContain('workflow.types.LEAVE');
    expect(link?.textContent).toContain('#3');
  });

  it('pages on the server', () => {
    const { cmp, svc } = setup(() => of(page([item(1)], 25)));
    cmp.onPage({ pageIndex: 2, pageSize: 20, length: 25 });
    expect(svc.inbox).toHaveBeenLastCalledWith(2, 20);
  });

  it('ignores an out-of-order response from an earlier page', () => {
    const first = new Subject<ApiResponse<PagedResponse<InboxItem>>>();
    const second = new Subject<ApiResponse<PagedResponse<InboxItem>>>();
    const calls = [first, second];
    const { fixture, el, cmp } = setup(() => calls.shift() ?? of(page([])));
    cmp.onPage({ pageIndex: 1, pageSize: 10, length: 20 });
    second.next(page([item(2, 'Second Page')]));
    first.next(page([item(1, 'First Page')]));
    fixture.detectChanges();
    expect(el.textContent).toContain('Second Page');
    expect(el.textContent).not.toContain('First Page');
  });
});
