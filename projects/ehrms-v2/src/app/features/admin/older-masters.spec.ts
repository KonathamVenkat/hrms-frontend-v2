import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { DocumentTypes } from './document-types/pages/document-type/document-type';
import { DocumentTypeService } from './document-types/services/document-type';
import { DocumentType } from './document-types/models/document-type';
import { OfficeLocations } from './office-locations/pages/office-location/office-location';
import { OfficeLocationService } from './office-locations/services/office-location';
import { OfficeLocation } from './office-locations/models/office-location';
import { WorkShifts } from './work-shifts/pages/work-shifts/work-shifts';
import { WorkShiftService } from './work-shifts/services/work-shift';
import { WorkShift } from './work-shifts/models/work-shift';
import { LeaveTypes } from './leave-types/pages/leave-types/leave-types';
import { LeaveTypeService } from './leave-types/services/leave-types';
import { LeaveType } from './leave-types/models/leave-type';
import { HolidayCalendar } from './holiday-calendar/pages/holiday-calendar/holiday-calendar';
import { HolidayService } from './holiday-calendar/services/holiday-calendar';
import { Holiday } from './holiday-calendar/models/holiday-calendar';

/** What every one of these screens exposes that the tests touch. */
interface Screen<R> {
  openEdit(record: R): void;
  onSubmit(): void;
  form: { invalid: boolean };
  error(): string | null;
}

interface Case<R> {
  name: string;
  component: Type<Screen<R>>;
  service: Type<unknown>;
  record: R;
  id: number;
  translationPrefix: string;
}

const documentType: DocumentType = {
  docTypeId: 3, docTypeCode: 'PASSPORT', docTypeName: 'Passport', docTypeNameAr: 'جواز', category: 'IDENTITY',
  isMandatory: true, hasExpiry: true, expiryNoticeDays: 30, allowedExtensions: 'PDF,JPG', maxFileSizeMb: 5,
  isActive: true, sortOrder: 1, version: 4,
};
const location: OfficeLocation = {
  locationId: 4, locationCode: 'JUBA_HQ', locationName: 'Juba HQ', locationNameAr: 'جوبا', locationType: 'HEAD_OFFICE',
  addressLine1: 'Main road', city: 'Juba', country: 'South Sudan', isActive: true, sortOrder: 1, version: 4,
};
const shift: WorkShift = {
  shiftId: 2, shiftCode: 'MORNING', shiftName: 'Morning', shiftNameAr: 'صباحي', shiftType: 'MORNING',
  startTime: '08:00', endTime: '16:00', breakDuration: 30, workingHours: 7.5, gracePeriod: 10,
  workingDays: 'MON,TUE,WED,THU,FRI', isOvernight: false, isFlexible: false, isActive: true, sortOrder: 1, version: 4,
};
const leaveType: LeaveType = {
  leaveTypeId: 7, code: 'ANNUAL', nameEn: 'Annual leave', nameAr: 'سنوية', defaultDays: 21, isPaid: true,
  isCarryForward: false, maxCarryDays: 0, requiresDocument: false, minNoticeDays: 0, maxConsecutiveDays: 0,
  applicableGender: 'ALL', isActive: true, sortOrder: 1, version: 4,
};
const holiday: Holiday = {
  holidayId: 6, holidayName: 'New Year', holidayNameAr: 'رأس السنة', holidayDate: '2027-01-01', holidayType: 'PUBLIC',
  isRecurring: true, year: 2027, isActive: true, version: 4,
};

const cases: Case<never>[] = [
  { name: 'document types', component: DocumentTypes, service: DocumentTypeService, record: documentType, id: 3, translationPrefix: 'admin.documentTypes' },
  { name: 'office locations', component: OfficeLocations, service: OfficeLocationService, record: location, id: 4, translationPrefix: 'admin.officeLocations' },
  { name: 'work shifts', component: WorkShifts, service: WorkShiftService, record: shift, id: 2, translationPrefix: 'admin.workShifts' },
  { name: 'leave types', component: LeaveTypes, service: LeaveTypeService, record: leaveType, id: 7, translationPrefix: 'admin.leaveTypes' },
  { name: 'holiday calendar', component: HolidayCalendar, service: HolidayService, record: holiday, id: 6, translationPrefix: 'admin.holidayCalendar' },
] as unknown as Case<never>[];

const ok = (data: unknown) => of({ success: true, message: '', statusCode: 200, data });

/** A service whose reads return empty lists, with `update` replaced by the given function. */
function serviceStub(update: ReturnType<typeof vi.fn>): unknown {
  const own: Record<string, unknown> = { update };
  return new Proxy(own, {
    get: (target, property: string) => (property in target ? target[property] : vi.fn(() => ok([]))),
  });
}

function setup(c: Case<never>, update: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [c.component],
    providers: [provideTranslateService(), { provide: c.service, useValue: serviceStub(update) }],
  });
  const fixture = TestBed.createComponent(c.component);
  fixture.detectChanges(); // runs ngOnInit, which builds the form
  return { comp: fixture.componentInstance as Screen<never>, translate: TestBed.inject(TranslateService) };
}

const refusal = (status: number, ruleCode?: string) =>
  throwError(() => new HttpErrorResponse({ status, error: { message: 'server text', errors: ruleCode ? { ruleCode } : {} } }));

describe.each(cases)('older master screen: $name', (c) => {
  it('sends the version the record was opened with when it is saved', () => {
    const update = vi.fn(() => ok(c.record));
    const { comp } = setup(c, update);

    comp.openEdit(c.record);
    expect(comp.form.invalid).toBe(false);
    comp.onSubmit();

    expect(update).toHaveBeenCalledWith(c.id, expect.objectContaining({ version: 4 }));
  });

  it('shows its own translated text when the server reports a conflict', () => {
    const update = vi.fn(() => refusal(409));
    const { comp, translate } = setup(c, update);
    translate.setTranslation('en', {});
    translate.use('en');
    const parts = c.translationPrefix.split('.');
    translate.setTranslation('en', { [parts[0]]: { [parts[1]]: { errors: { rules: { conflict: 'CHANGED BY SOMEONE ELSE' } } } } });

    comp.openEdit(c.record);
    comp.onSubmit();

    expect(comp.error()).toBe('CHANGED BY SOMEONE ELSE');
  });

  it('falls back to the server text when the screen has no text for the refusal', () => {
    const update = vi.fn(() => refusal(422, 'SOMETHING_ELSE'));
    const { comp } = setup(c, update);

    comp.openEdit(c.record);
    comp.onSubmit();

    expect(comp.error()).toBe('server text');
  });
});

describe('leave type code in use', () => {
  it('shows the translated reason when the code of a type in use is changed', () => {
    const update = vi.fn(() => refusal(422, 'LEAVE_TYPE_CODE_IN_USE'));
    const { comp, translate } = setup(cases[3], update);
    translate.setTranslation('en', {
      admin: { leaveTypes: { errors: { rules: { LEAVE_TYPE_CODE_IN_USE: 'CODE IS IN USE' } } } },
    });
    translate.use('en');

    comp.openEdit(leaveType as never);
    comp.onSubmit();

    expect(comp.error()).toBe('CODE IS IN USE');
  });
});
