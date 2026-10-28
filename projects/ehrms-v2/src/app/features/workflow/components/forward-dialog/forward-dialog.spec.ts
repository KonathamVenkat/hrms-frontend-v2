import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { DepartmentLookup } from '../../../employee/models/employee';
import { StepOutcome } from '../../models/workflow.model';
import { DialogKind, DialogResult, ForwardDialog } from './forward-dialog';

const DEPTS: DepartmentLookup[] = [
  { id: 3, code: 'FIN', name: 'Finance', nameAr: 'المالية' },
  { id: 4, code: 'HR', name: 'Human Resources', nameAr: 'الموارد البشرية' },
];

function setup(
  kind: DialogKind,
  opts: { pickDepartment?: boolean; outcomes?: StepOutcome[]; busy?: boolean } = {},
) {
  TestBed.configureTestingModule({
    imports: [ForwardDialog, NoopAnimationsModule],
    providers: [provideTranslateService()],
  });
  const fixture = TestBed.createComponent(ForwardDialog);
  const ref = fixture.componentRef;
  ref.setInput('kind', kind);
  ref.setInput('requesterName', 'Ayen Deng');
  ref.setInput('summary', 'Annual 2026-11-01 to 2026-11-05 (5 days)');
  ref.setInput('pickDepartment', opts.pickDepartment ?? false);
  ref.setInput('departments', DEPTS);
  ref.setInput('outcomes', opts.outcomes ?? []);
  ref.setInput('busy', opts.busy ?? false);
  const confirmed: DialogResult[] = [];
  fixture.componentInstance.confirmed.subscribe((r) => confirmed.push(r));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const confirmBtn = () => el.querySelector<HTMLButtonElement>('button.confirm-btn');
  return { fixture, el, confirmed, confirmBtn };
}

describe('ForwardDialog', () => {
  it('names the employee and the leave in the confirmation text', () => {
    const { el } = setup('APPROVE');
    const message = el.querySelector('.dialog-message')?.textContent ?? '';
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(message).toContain('workflow.dialog.APPROVE.message');
    expect(el.textContent).toContain('Ayen Deng');
    expect(el.textContent).toContain('Annual 2026-11-01 to 2026-11-05 (5 days)');
  });

  it('requires a reason to reject and does not emit until it is given', () => {
    const { fixture, el, confirmed, confirmBtn } = setup('REJECT');
    confirmBtn()?.click();
    fixture.detectChanges();
    expect(confirmed.length).toBe(0);
    expect(el.querySelector('mat-error')).not.toBeNull();

    const area = el.querySelector<HTMLTextAreaElement>('textarea');
    area!.value = '  Not enough cover  ';
    area!.dispatchEvent(new Event('input'));
    confirmBtn()?.click();
    expect(confirmed).toEqual([
      { outcome: 'REJECT', targetDepartmentId: null, text: 'Not enough cover' },
    ]);
  });

  it('sends a blank optional comment as null, never an empty string', () => {
    const { confirmed, confirmBtn } = setup('APPROVE');
    confirmBtn()?.click();
    expect(confirmed).toEqual([{ outcome: 'APPROVE', targetDepartmentId: null, text: null }]);
  });

  it('shows the department picker only when the step asks for it, and requires it to forward', () => {
    const without = setup('FORWARD');
    expect(without.el.querySelector('mat-select')).toBeNull();
    TestBed.resetTestingModule();

    const { fixture, el, confirmed, confirmBtn } = setup('FORWARD', { pickDepartment: true });
    expect(el.querySelector('mat-select')).not.toBeNull();
    confirmBtn()?.click();
    fixture.detectChanges();
    expect(confirmed.length).toBe(0);

    fixture.componentInstance.form.controls.targetDepartmentId.setValue(3);
    confirmBtn()?.click();
    expect(confirmed).toEqual([{ outcome: 'FORWARD', targetDepartmentId: 3, text: null }]);
  });

  it('does not ask for a department when rejecting at a pick-department step', () => {
    const { el } = setup('REJECT', { pickDepartment: true });
    expect(el.querySelector('mat-select')).toBeNull();
  });

  it('disables the buttons and ignores a second click while a call is in flight', () => {
    const { confirmed, confirmBtn } = setup('APPROVE', { busy: true });
    expect(confirmBtn()?.disabled).toBe(true);
    confirmBtn()?.click();
    expect(confirmed.length).toBe(0);
  });

  it('for an override asks for the outcome and a reason', () => {
    const { fixture, el, confirmed, confirmBtn } = setup('OVERRIDE', {
      outcomes: ['APPROVE', 'REJECT'],
    });
    expect(el.querySelector('mat-select')).not.toBeNull();
    confirmBtn()?.click();
    expect(confirmed.length).toBe(0);
    const f = fixture.componentInstance.form.controls;
    f.outcome.setValue('APPROVE');
    f.text.setValue('Head is on long leave');
    confirmBtn()?.click();
    expect(confirmed).toEqual([
      { outcome: 'APPROVE', targetDepartmentId: null, text: 'Head is on long leave' },
    ]);
  });

  it('an override that forwards on a step that picks no department sends no department', () => {
    const { fixture, el, confirmed, confirmBtn } = setup('OVERRIDE', {
      outcomes: ['FORWARD', 'APPROVE', 'REJECT'],
    });
    const f = fixture.componentInstance.form.controls;
    f.outcome.setValue('FORWARD');
    f.text.setValue('Secretary left');
    fixture.detectChanges();
    expect(el.querySelectorAll('mat-select').length).toBe(1); // the outcome only
    confirmBtn()?.click();
    expect(confirmed).toEqual([
      { outcome: 'FORWARD', targetDepartmentId: null, text: 'Secretary left' },
    ]);
  });

  it('an override that forwards on a department-picking step requires the department', () => {
    const { fixture, el, confirmed, confirmBtn } = setup('OVERRIDE', {
      outcomes: ['FORWARD', 'APPROVE', 'REJECT'],
      pickDepartment: true,
    });
    const f = fixture.componentInstance.form.controls;
    f.outcome.setValue('FORWARD');
    f.text.setValue('Branch manager left');
    fixture.detectChanges();
    expect(el.querySelectorAll('mat-select').length).toBe(2);
    confirmBtn()?.click();
    expect(confirmed.length).toBe(0);
    f.targetDepartmentId.setValue(4);
    confirmBtn()?.click();
    expect(confirmed).toEqual([
      { outcome: 'FORWARD', targetDepartmentId: 4, text: 'Branch manager left' },
    ]);
  });

  it('shows an error from the server inside the dialog as an alert', () => {
    const { fixture, el } = setup('APPROVE');
    fixture.componentRef.setInput('error', 'Already handled');
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Already handled');
  });
});
