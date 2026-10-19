import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { DepartmentHeadCard } from './department-head';
import { DepartmentHeadService } from '../../services/department-head.service';
import { DepartmentHead } from '../../models/department-head.model';

const notHead: DepartmentHead = {
  departmentId: 10,
  departmentName: 'IT',
  departmentCode: 'IT',
  head: false,
  currentHeadId: 9,
  currentHeadName: 'Jane Doe',
};
const isHead: DepartmentHead = { ...notHead, head: true, currentHeadId: 5, currentHeadName: 'Sam' };
const wrap = (data: DepartmentHead) => ({ success: true, message: '', statusCode: 200, data });

function setup(get: ReturnType<typeof vi.fn>, set = vi.fn()) {
  TestBed.configureTestingModule({
    imports: [DepartmentHeadCard],
    providers: [
      provideTranslateService(),
      { provide: DepartmentHeadService, useValue: { get, set } },
    ],
  });
  const fixture = TestBed.createComponent(DepartmentHeadCard);
  fixture.componentRef.setInput('employeeId', 5);
  fixture.componentRef.setInput('departmentId', 10);
  fixture.detectChanges();
  return { fixture, set, el: fixture.nativeElement as HTMLElement };
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('DepartmentHeadCard', () => {
  it('shows a loading state until the head arrives', async () => {
    const pending = new Subject<ReturnType<typeof wrap>>();
    const { fixture, el } = setup(vi.fn(() => pending));

    expect(el.querySelector('[role="status"]')).not.toBeNull();

    pending.next(wrap(notHead));
    pending.complete();
    await settle(fixture);
    expect(el.querySelector('.head-status')).not.toBeNull();
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('shows an error with a retry button when loading fails', async () => {
    const get = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, el } = setup(get);
    await settle(fixture);

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.querySelector('.head-alert button')).not.toBeNull();
  });

  it('asks for confirmation naming the head that will be replaced, and does not save yet', async () => {
    const { fixture, set, el } = setup(vi.fn(() => of(wrap(notHead))));
    await settle(fixture);

    (el.querySelector('.head-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.confirm-dialog')?.textContent).toContain('IT');
    expect(fixture.componentInstance.replacedName()).toBe('Jane Doe');
    expect(set).not.toHaveBeenCalled();
  });

  it('saves once on confirm even if the button is clicked twice', async () => {
    const pending = new Subject<ReturnType<typeof wrap>>();
    const { fixture, set } = setup(
      vi.fn(() => of(wrap(notHead))),
      vi.fn(() => pending),
    );
    await settle(fixture);
    fixture.componentInstance.openConfirm();

    fixture.componentInstance.confirm();
    fixture.componentInstance.confirm();

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(5, true);
    expect(fixture.componentInstance.saving()).toBe(true);

    pending.next(wrap(isHead));
    pending.complete();
    await settle(fixture);
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(fixture.componentInstance.confirming()).toBe(false);
    expect(fixture.componentInstance.info.value()?.head).toBe(true);
  });

  it('removes the head when the employee already is head', async () => {
    const { fixture, set } = setup(
      vi.fn(() => of(wrap(isHead))),
      vi.fn(() =>
        of(wrap({ ...isHead, head: false, currentHeadId: undefined, currentHeadName: undefined })),
      ),
    );
    await settle(fixture);

    fixture.componentInstance.confirm();

    expect(set).toHaveBeenCalledWith(5, false);
  });

  it('keeps the dialog open with the reason when the server refuses', async () => {
    const refusal = new HttpErrorResponse({
      status: 409,
      error: { errors: { ruleCode: 'EMP_INACTIVE' } },
    });
    const { fixture } = setup(
      vi.fn(() => of(wrap(notHead))),
      vi.fn(() => throwError(() => refusal)),
    );
    await settle(fixture);
    fixture.componentInstance.openConfirm();

    fixture.componentInstance.confirm();

    expect(fixture.componentInstance.confirming()).toBe(true);
    expect(fixture.componentInstance.confirmError()).toBeTruthy();
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(fixture.componentInstance.info.value()?.head).toBe(false);
  });
});
