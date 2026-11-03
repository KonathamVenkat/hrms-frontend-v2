import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EmployeeIdentityComponent } from './employee-identity';
import { IdentityService } from '../../services/identity.service';
import { IdentityInfo } from '../../models/identity.model';

function setup(identity: IdentityInfo) {
  const identityService = {
    get: vi.fn(() => of({ success: true, message: '', statusCode: 200, data: identity })),
    save: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [EmployeeIdentityComponent],
    providers: [provideTranslateService(), { provide: IdentityService, useValue: identityService }],
  });

  const fixture = TestBed.createComponent(EmployeeIdentityComponent);
  fixture.componentRef.setInput('employeeId', identity.employeeId);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('EmployeeIdentityComponent masking', () => {
  const masked: IdentityInfo = {
    employeeIdentityId: 1,
    employeeId: 5,
    nationalId: '*****6789',
    biometricId: '*IO12',
    masked: true,
  };

  it('shows the server-masked values as they are and hides reveal and edit controls', () => {
    const { component, el } = setup(masked);

    expect(component.isMasked()).toBe(true);
    expect(component.displayValue(masked.nationalId, 'nationalId')).toBe('*****6789');
    expect(el.querySelector('.pii-toggle')).toBeNull();
    expect(el.querySelector('.btn-edit-info')).toBeNull();
    expect(el.querySelector('.alert-info')).not.toBeNull();
  });

  it('does not open the edit form for a masked view', () => {
    const { component } = setup(masked);

    component.openEdit();

    expect(component.editMode()).toBe(false);
  });

  it('keeps reveal and edit controls for a viewer who gets the real values', () => {
    const real: IdentityInfo = { ...masked, nationalId: '123456789', biometricId: 'BIO12', masked: false };
    const { component, el } = setup(real);

    expect(component.isMasked()).toBe(false);
    expect(el.querySelector('.pii-toggle')).not.toBeNull();
    expect(el.querySelector('.btn-edit-info')).not.toBeNull();
    expect(el.querySelector('.alert-info')).toBeNull();
    // Client-side dotted masking still applies until the viewer reveals the value.
    expect(component.displayValue('123456789', 'nationalId')).toBe('•••••6789');
  });

  it('shows real values but no edit controls to a viewer who may not change them', () => {
    const real: IdentityInfo = { ...masked, nationalId: '123456789', biometricId: 'BIO12', masked: false };
    const { fixture, component, el } = setup(real);

    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();
    component.openEdit();

    expect(component.canEdit()).toBe(false);
    expect(el.querySelector('.btn-edit-info')).toBeNull();
    expect(el.querySelector('.pii-toggle')).not.toBeNull();
    expect(component.editMode()).toBe(false);
  });
});

describe('EmployeeIdentityComponent national ID details and residence', () => {
  const real: IdentityInfo = {
    employeeIdentityId: 1,
    employeeId: 5,
    nationalId: '123456789',
    nationalIdType: 'By birth',
    nationalIdIssueDate: '1986-09-22',
    nationalIdIssuePlace: 'Omdurman',
    residenceDate: '2020-01-01',
    residencePlace: 'Wad Balal',
    residenceValidUntil: '2030-01-01',
    masked: false,
    version: 4,
  };

  it('opens the edit form with the new fields filled in', () => {
    const { component } = setup(real);

    component.openEdit();

    expect(component.form.getRawValue()).toMatchObject({
      nationalIdType: 'By birth',
      nationalIdIssueDate: '1986-09-22',
      nationalIdIssuePlace: 'Omdurman',
      residenceDate: '2020-01-01',
      residencePlace: 'Wad Balal',
      residenceValidUntil: '2030-01-01',
    });
  });

  it('sends the new fields on save, and leaves an emptied one out so the backend clears it', () => {
    const { component } = setup(real);
    const save = TestBed.inject(IdentityService).save as ReturnType<typeof vi.fn>;
    save.mockReturnValue(of({ success: true, message: '', statusCode: 200, data: real }));

    component.openEdit();
    component.form.patchValue({ nationalIdIssuePlace: '', residenceValidUntil: '2031-02-03' });
    component.onSubmit();

    const payload = save.mock.calls[0][1];
    expect(payload).toMatchObject({ nationalIdType: 'By birth', residencePlace: 'Wad Balal', residenceValidUntil: '2031-02-03', version: 4 });
    expect(payload.nationalIdIssuePlace).toBeUndefined();
  });
});

describe('EmployeeIdentityComponent edit form (modal with the unsaved-changes question)', () => {
  const real: IdentityInfo = {
    employeeIdentityId: 1,
    employeeId: 5,
    nationalId: '123456789',
    masked: false,
    version: 1,
  };
  const dialogs = (el: HTMLElement) => el.querySelectorAll('[role=dialog]');
  const question = (el: HTMLElement) => el.querySelector('app-discard-changes');

  it('opens as a modal dialog, not inline on the page', () => {
    const { component, fixture, el } = setup(real);

    component.openEdit();
    fixture.detectChanges();

    expect(dialogs(el)).toHaveLength(1);
    expect(el.querySelector('.modal-backdrop .modal #id-national-id')).not.toBeNull();
    expect(el.querySelector('.identity-grid')).not.toBeNull(); // the saved details stay visible behind it
  });

  it('closes at once when nothing was typed', () => {
    const { component, fixture, el } = setup(real);
    component.openEdit();
    fixture.detectChanges();

    component.requestClose();
    fixture.detectChanges();

    expect(component.editMode()).toBe(false);
    expect(dialogs(el)).toHaveLength(0);
    expect(question(el)).toBeNull();
  });

  it('asks before closing when something was typed, and keeps the form and the text on "keep editing"', () => {
    const { component, fixture, el } = setup(real);
    component.openEdit();
    component.form.controls.taxId.setValue('TAX-1');
    component.form.controls.taxId.markAsDirty();
    fixture.detectChanges();

    component.requestClose();
    fixture.detectChanges();
    expect(component.editMode()).toBe(true);
    expect(question(el)).not.toBeNull();

    component.discard.keep();
    fixture.detectChanges();
    expect(question(el)).toBeNull();
    expect(component.editMode()).toBe(true);
    expect(component.form.controls.taxId.value).toBe('TAX-1');
  });

  it('closes and forgets the edits on "discard changes", so the next edit starts clean', () => {
    const { component, fixture, el } = setup(real);
    component.openEdit();
    component.form.controls.taxId.setValue('TAX-1');
    component.form.controls.taxId.markAsDirty();
    component.requestClose();
    fixture.detectChanges();

    component.discardChanges();
    fixture.detectChanges();
    expect(component.editMode()).toBe(false);
    expect(question(el)).toBeNull();

    component.openEdit();
    expect(component.form.dirty).toBe(false);
    component.requestClose();
    expect(component.editMode()).toBe(false); // no question this time
  });

  it('treats Escape while the question is open as "keep editing"', () => {
    const { component } = setup(real);
    component.openEdit();
    component.form.controls.taxId.markAsDirty();

    component.requestClose();
    expect(component.discard.asking()).toBe(true);
    component.requestClose();

    expect(component.discard.asking()).toBe(false);
    expect(component.editMode()).toBe(true);
  });
});

describe('EmployeeIdentityComponent validation and the empty first save', () => {
  const none: IdentityInfo = { employeeId: 5, masked: false };
  const saved: IdentityInfo = { employeeIdentityId: 1, employeeId: 5, nationalId: '123456789', masked: false, version: 1 };

  function save(identity: IdentityInfo) {
    const ctx = setup(identity);
    const service = TestBed.inject(IdentityService).save as ReturnType<typeof vi.fn>;
    service.mockReturnValue(of({ success: true, message: '', statusCode: 200, data: { ...identity, nationalId: 'X' } }));
    return { ...ctx, service };
  }

  it('does not save a first form with nothing in it, and says why', () => {
    const { component, fixture, el, service } = save(none);
    component.openEdit();
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    expect(service).not.toHaveBeenCalled();
    expect(component.attempted()).toBe(true);
    expect(component.saving()).toBe(false);
    expect(el.querySelector('.modal-alert')?.textContent).toContain('employee.identity.errors.nothingEntered');
  });

  it('treats spaces only as nothing', () => {
    const { component, service } = save(none);
    component.openEdit();
    component.form.patchValue({ nationalId: '   ', visaType: ' ' });

    component.onSubmit();

    expect(service).not.toHaveBeenCalled();
  });

  it('saves a first form that has a single detail', () => {
    const { component, service } = save(none);
    component.openEdit();
    component.form.patchValue({ taxId: 'TAX-1' });

    component.onSubmit();

    expect(service).toHaveBeenCalledTimes(1);
  });

  it('lets a saved record be cleared completely', () => {
    const { component, service } = save(saved);
    component.openEdit();
    component.form.patchValue({ nationalId: '' });

    component.onSubmit();

    expect(service).toHaveBeenCalledTimes(1);
  });

  it('refuses text longer than the server allows, field by field, with a message', () => {
    const { component, fixture, el, service } = save(saved);
    component.openEdit();
    component.form.patchValue({ visaType: 'v'.repeat(51), nationalIdType: 'n'.repeat(41), taxId: 't'.repeat(201) });

    component.onSubmit();
    fixture.detectChanges();

    expect(service).not.toHaveBeenCalled();
    expect(component.isInvalid('visaType')).toBe(true);
    expect(component.isInvalid('nationalIdType')).toBe(true);
    expect(component.isInvalid('taxId')).toBe(true);
    expect(el.querySelector('#fe-visaType')?.textContent).toContain('common.validation.maxLength');
    expect(component.form.controls.nationalId.valid).toBe(true);
  });

  it('accepts text exactly at the limit', () => {
    const { component, service } = save(saved);
    component.openEdit();
    component.form.patchValue({ visaType: 'v'.repeat(50), taxId: 't'.repeat(200) });

    component.onSubmit();

    expect(service).toHaveBeenCalledTimes(1);
  });

  it('refuses a visa that expires before it was issued, and a residence that ends before it began', () => {
    const { component, fixture, el, service } = save(saved);
    component.openEdit();
    component.form.patchValue({
      visaIssueDate: '2026-05-02',
      visaExpiryDate: '2026-05-01',
      residenceDate: '2026-06-02',
      residenceValidUntil: '2026-06-01',
    });

    component.onSubmit();
    fixture.detectChanges();

    expect(service).not.toHaveBeenCalled();
    expect(el.querySelector('#fe-visaExpiryDate')?.textContent).toContain('employee.identity.errors.visaDates');
    expect(el.querySelector('#fe-residenceValidUntil')?.textContent).toContain('employee.identity.errors.residenceDates');
  });

  it('accepts a visa that expires the day it was issued', () => {
    const { component, service } = save(saved);
    component.openEdit();
    component.form.patchValue({ visaIssueDate: '2026-05-01', visaExpiryDate: '2026-05-01' });

    component.onSubmit();

    expect(service).toHaveBeenCalledTimes(1);
  });

  it('refuses a national ID issued in the future', () => {
    const { component, fixture, el, service } = save(saved);
    component.openEdit();
    component.form.patchValue({ nationalIdIssueDate: '2999-01-01' });

    component.onSubmit();
    fixture.detectChanges();

    expect(service).not.toHaveBeenCalled();
    expect(el.querySelector('#fe-nationalIdIssueDate')?.textContent).toContain('employee.identity.errors.futureIssue');
  });

  it('does not send a second save while one is in flight', () => {
    const { component, service } = save(saved);
    component.openEdit();
    component.form.patchValue({ taxId: 'TAX-1' });
    component.saving.set(true);

    component.onSubmit();

    expect(service).not.toHaveBeenCalled();
  });

  it('asks "nothing entered yet" when a first, empty form is closed', () => {
    const { component, fixture, el } = save(none);
    component.openEdit();
    fixture.detectChanges();

    component.requestClose();
    fixture.detectChanges();

    expect(component.editMode()).toBe(true);
    expect(component.discard.kind()).toBe('empty');
    expect(el.querySelector('app-discard-changes')).not.toBeNull();
  });

  it('closes an untouched form of a saved record at once, as before', () => {
    const { component, fixture } = save(saved);
    component.openEdit();
    fixture.detectChanges();

    component.requestClose();

    expect(component.editMode()).toBe(false);
  });
});

describe('EmployeeIdentityComponent Close buttons', () => {
  const none: IdentityInfo = { employeeId: 5, masked: false };
  const saved: IdentityInfo = { employeeIdentityId: 1, employeeId: 5, nationalId: '123456789', masked: false, version: 1 };

  it('hides the X and Cancel while the first identity record is not saved yet, and keeps Save', () => {
    const { component, fixture, el } = setup(none);
    component.openEdit();
    fixture.detectChanges();

    expect(el.querySelector('.modal-close')).toBeNull();
    expect(el.querySelector('.modal-footer .btn-cancel')).toBeNull();
    expect(el.querySelector('.modal-footer .btn-save')).not.toBeNull();
  });

  it('shows the X and Cancel once a record is saved, so the form can be closed', () => {
    const { component, fixture, el } = setup(saved);
    component.openEdit();
    fixture.detectChanges();

    expect(el.querySelector('.modal-close')).not.toBeNull();
    expect(el.querySelector('.modal-footer .btn-cancel')).not.toBeNull();
  });

  it('still blocks Escape on the first form, with the notice', () => {
    const { component, fixture, el } = setup(none);
    component.openEdit();
    fixture.detectChanges();

    component.requestClose();
    fixture.detectChanges();

    expect(component.editMode()).toBe(true);
    expect(el.querySelector('app-discard-changes')).not.toBeNull();
  });
});
