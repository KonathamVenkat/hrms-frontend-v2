import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { Stage } from '../../models/setup.model';
import { RecruitmentSetupService } from '../../services/recruitment-setup.service';
import { RecruitmentStages } from './stages';

const stage = (over: Partial<Stage>): Stage => ({
  id: 1,
  code: 'APPLIED',
  name: 'Applied',
  nameAr: 'تم التقديم',
  stageType: 'OPEN',
  sortOrder: 1,
  isSystem: true,
  isActive: true,
  version: 0,
  ...over,
});

function setup(stages: Stage[]) {
  const svc = {
    getStages: vi.fn(() => of({ success: true, message: '', statusCode: 200, data: stages })),
    createStage: vi.fn(),
    updateStage: vi.fn(),
    setStageActive: vi.fn(),
    deleteStage: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [RecruitmentStages, NoopAnimationsModule],
    providers: [provideTranslateService(), { provide: RecruitmentSetupService, useValue: svc }],
  });
  const fixture = TestBed.createComponent(RecruitmentStages);
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    svc,
    el: fixture.nativeElement as HTMLElement,
  };
}

describe('RecruitmentStages', () => {
  it('offers no deactivate or delete button on a system stage', () => {
    const { el } = setup([
      stage({ id: 1, isSystem: true }),
      stage({ id: 2, code: 'SCREENING', isSystem: false }),
    ]);
    const rows = el.querySelectorAll('tbody tr.data-row');
    expect(rows[0].querySelectorAll('button.act-btn').length).toBe(1); // edit only
    expect(rows[1].querySelectorAll('button.act-btn').length).toBe(3); // edit, toggle, delete
  });

  it('locks the type of any stage and the code of a system stage when editing', () => {
    const { component } = setup([]);
    component.openEdit(stage({ isSystem: true }));
    expect(component.form.controls.stageType.disabled).toBe(true);
    expect(component.form.controls.code.disabled).toBe(true);

    component.openEdit(stage({ id: 2, code: 'SCREENING', isSystem: false }));
    expect(component.form.controls.stageType.disabled).toBe(true);
    expect(component.form.controls.code.enabled).toBe(true);

    component.openCreate();
    expect(component.form.controls.stageType.enabled).toBe(true);
  });

  it('upper-cases the code as the user types', () => {
    const { component } = setup([]);
    component.openCreate();
    component.form.controls.code.setValue('phone_screen');
    expect(component.form.controls.code.value).toBe('PHONE_SCREEN');
  });

  it('does not send an invalid form', () => {
    const { component, svc } = setup([]);
    component.openCreate();
    component.onSubmit();
    expect(svc.createStage).not.toHaveBeenCalled();
    expect(component.form.controls.code.touched).toBe(true);
  });

  it('sends an update with the loaded version, once, however often the button is pressed', () => {
    const inFlight = new Subject<never>();
    const { component, svc } = setup([]);
    svc.updateStage.mockReturnValue(inFlight);
    component.openEdit(stage({ id: 2, code: 'SCREENING', isSystem: false, version: 6 }));
    component.onSubmit();
    component.onSubmit();
    expect(svc.updateStage).toHaveBeenCalledTimes(1);
    expect(svc.updateStage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ code: 'SCREENING', version: 6 }),
    );
  });

  it('keeps the dialog open with a translated message when the server refuses', () => {
    const { component, svc } = setup([]);
    svc.createStage.mockReturnValue(
      throwError(() => ({ status: 409, error: { errors: { ruleCode: 'STAGE_TERMINAL_EXISTS' } } })),
    );
    component.openCreate();
    component.form.patchValue({
      code: 'HIRED_2',
      name: 'Hired 2',
      nameAr: 'x',
      stageType: 'HIRED',
    });
    component.onSubmit();
    expect(component.showModal()).toBe(true);
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('recruitment.errors.stale'); // no translation loaded in the test: falls back by status
  });

  it('shows a refused delete inside the confirmation dialog', () => {
    const { component, svc } = setup([stage({ id: 2, isSystem: false })]);
    svc.deleteStage.mockReturnValue(throwError(() => ({ status: 403 })));
    component.openConfirm(stage({ id: 2, isSystem: false }), 'delete');
    component.confirm();
    expect(component.confirmItem()).not.toBeNull();
    expect(component.confirmError()).toBe('common.httpErrors.forbidden');
  });
});
