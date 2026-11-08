import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { OfficeLocations } from './office-location';
import { OfficeLocationService } from '../../services/office-location';
import { OfficeLocation } from '../../models/office-location';

const location: OfficeLocation = {
  locationId: 4,
  locationCode: 'JUBA_HQ',
  locationName: 'Juba HQ',
  locationNameAr: 'جوبا',
  locationType: 'HEAD_OFFICE',
  addressLine1: 'Main road',
  city: 'Juba',
  country: 'South Sudan',
  timezone: 'Africa/Juba',
  isActive: true,
  sortOrder: 1,
  version: 2,
};

function setup() {
  const update = vi.fn(() => of({ success: true, message: '', statusCode: 200, data: location }));
  const service = new Proxy({ update } as Record<string, unknown>, {
    get: (target, property: string) =>
      property in target ? target[property] : vi.fn(() => of({ success: true, message: '', statusCode: 200, data: [location] })),
  });
  TestBed.configureTestingModule({
    imports: [OfficeLocations],
    providers: [provideTranslateService(), { provide: OfficeLocationService, useValue: service }],
  });
  const fixture = TestBed.createComponent(OfficeLocations);
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', { admin: { officeLocations: { errors: { patternPhone: 'PHONE SHAPE' } } } });
  translate.use('en');
  fixture.detectChanges();
  return { fixture, update, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('office location screen: phone', () => {
  it('refuses a phone that is not a phone number, says why and tells assistive technology', () => {
    const { fixture, comp, el, update } = setup();
    comp.openEdit(location);
    fixture.detectChanges();

    const phone = el.querySelector<HTMLInputElement>('#ol-phone');
    expect(phone).not.toBeNull();
    comp.form.controls['phone'].setValue('call me');
    comp.form.controls['phone'].markAsTouched();
    fixture.detectChanges();

    expect(phone?.getAttribute('aria-invalid')).toBe('true');
    expect(phone?.getAttribute('aria-describedby')).toBe('ol-phone-error');
    expect(el.querySelector('#ol-phone-error')?.textContent).toContain('PHONE SHAPE');
    comp.onSubmit();
    expect(update).not.toHaveBeenCalled();
  });

  it('accepts a normal phone number and an empty one', () => {
    const { fixture, comp } = setup();
    comp.openEdit(location);
    fixture.detectChanges();

    for (const good of ['+211 912 345 678', '(0921) 345-678', '']) {
      comp.form.controls['phone'].setValue(good);
      expect(comp.form.controls['phone'].valid).toBe(true);
    }
  });

  it('sends the empty time zone as "not given" so the server default applies', () => {
    const { fixture, comp, update } = setup();
    comp.openEdit(location);
    comp.form.controls['timezone'].setValue('');
    fixture.detectChanges();

    comp.onSubmit();

    expect(update).toHaveBeenCalledWith(4, expect.objectContaining({ timezone: undefined, version: 2 }));
  });
});
