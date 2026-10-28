import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { DepartmentSecretaryCard } from './department-secretary';
import { DepartmentSecretaryService } from '../../services/department-secretary.service';
import { DepartmentSecretary } from '../../models/department-secretary.model';

const notSecretary: DepartmentSecretary = {
  departmentId: 10,
  departmentName: 'IT',
  departmentCode: 'IT',
  secretary: false,
  currentSecretaryId: 9,
  currentSecretaryName: 'Jane Doe',
};
const isSecretary: DepartmentSecretary = {
  ...notSecretary,
  secretary: true,
  currentSecretaryId: 5,
  currentSecretaryName: 'Sam',
};
const wrap = (data: DepartmentSecretary) => ({ success: true, message: '', statusCode: 200, data });

function setup(get: ReturnType<typeof vi.fn>, set = vi.fn()) {
  TestBed.configureTestingModule({
    imports: [DepartmentSecretaryCard],
    providers: [
      provideTranslateService(),
      { provide: DepartmentSecretaryService, useValue: { get, set } },
    ],
  });
  const fixture = TestBed.createComponent(DepartmentSecretaryCard);
  fixture.componentRef.setInput('employeeId', 5);
  fixture.componentRef.setInput('departmentId', 10);
  fixture.detectChanges();
  return { fixture, set, el: fixture.nativeElement as HTMLElement };
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('DepartmentSecretaryCard', () => {
  it('shows a loading state until the secretary arrives', async () => {
    const pending = new Subject<ReturnType<typeof wrap>>();
    const { fixture, el } = setup(vi.fn(() => pending));

    expect(el.querySelector('[role="status"]')).not.toBeNull();

    pending.next(wrap(notSecretary));
    pending.complete();
    await settle(fixture);
    expect(el.querySelector('.secretary-status')).not.toBeNull();
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('shows an error with a retry button when loading fails', async () => {
    const get = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, el } = setup(get);
    await settle(fixture);

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.querySelector('.secretary-alert button')).not.toBeNull();
  });

  it('asks for confirmation naming the secretary that will be replaced, and does not save yet', async () => {
    const { fixture, set, el } = setup(vi.fn(() => of(wrap(notSecretary))));
    await settle(fixture);

    (el.querySelector('.secretary-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.confirm-dialog')?.textContent).toContain('IT');
    expect(fixture.componentInstance.replacedName()).toBe('Jane Doe');
    expect(set).not.toHaveBeenCalled();
  });

  it('names the employee in the confirmation message', async () => {
    const { fixture, el } = setup(vi.fn(() => of(wrap(notSecretary))));
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', {
      employee: { departmentSecretary: { makeMsgNamed: '{{name}} will receive requests' } },
    });
    t.use('en');
    fixture.componentRef.setInput('employeeName', 'Ali Musa');
    await settle(fixture);

    fixture.componentInstance.openConfirm();
    fixture.detectChanges();

    expect(el.querySelector('.confirm-msg')?.textContent).toContain(
      'Ali Musa will receive requests',
    );
  });

  it('saves once on confirm even if the button is clicked twice', async () => {
    const pending = new Subject<ReturnType<typeof wrap>>();
    const { fixture, set } = setup(
      vi.fn(() => of(wrap(notSecretary))),
      vi.fn(() => pending),
    );
    await settle(fixture);
    fixture.componentInstance.openConfirm();

    fixture.componentInstance.confirm();
    fixture.componentInstance.confirm();

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(5, true);
    expect(fixture.componentInstance.saving()).toBe(true);

    pending.next(wrap(isSecretary));
    pending.complete();
    await settle(fixture);
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(fixture.componentInstance.confirming()).toBe(false);
    expect(fixture.componentInstance.info.value()?.secretary).toBe(true);
  });

  it('removes the secretary when the employee already is secretary', async () => {
    const { fixture, set } = setup(
      vi.fn(() => of(wrap(isSecretary))),
      vi.fn(() =>
        of(
          wrap({
            ...isSecretary,
            secretary: false,
            currentSecretaryId: undefined,
            currentSecretaryName: undefined,
          }),
        ),
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
      vi.fn(() => of(wrap(notSecretary))),
      vi.fn(() => throwError(() => refusal)),
    );
    await settle(fixture);
    fixture.componentInstance.openConfirm();

    fixture.componentInstance.confirm();

    expect(fixture.componentInstance.confirming()).toBe(true);
    expect(fixture.componentInstance.confirmError()).toBeTruthy();
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(fixture.componentInstance.info.value()?.secretary).toBe(false);
  });
});
