import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MasterData } from './master-data';
import { MasterDataService } from '../../services/master-data';
import { MasterRecord } from '../../models/master';
import { MasterConfig, REFERENCE_MASTER_ROUTES } from '../../masters.config';

const config = (path: string): MasterConfig => {
  const found = REFERENCE_MASTER_ROUTES.find((r) => r.path === path);
  if (!found) throw new Error(`no master ${path}`);
  return found.master;
};

const reply = <T>(data: T) => of({ success: true, message: '', statusCode: 200, data });
const region: MasterRecord = {
  id: 1,
  code: 'EQU',
  name: 'Greater Equatoria',
  nameAr: 'x',
  isActive: true,
};

function setup(cfg: MasterConfig) {
  const svc = {
    getAll: vi.fn((endpoint: string) => reply(endpoint === 'regions' ? [region] : [])),
    create: vi.fn(() => reply({ ...region, id: 9, name: 'Created' })),
    update: vi.fn(),
    deactivate: vi.fn(),
    activate: vi.fn(),
    delete: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [MasterData],
    providers: [
      provideTranslateService(),
      { provide: ActivatedRoute, useValue: { snapshot: { data: { master: cfg } } } },
      { provide: MasterDataService, useValue: svc },
    ],
  });
  const fixture = TestBed.createComponent(MasterData);
  fixture.detectChanges();
  return {
    fixture,
    svc,
    comp: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
  };
}

describe('MasterData (reference masters)', () => {
  it('loads the parents of a master that has one and sends the chosen parent id on create', () => {
    const { comp, svc, fixture } = setup(config('wilayas'));
    expect(svc.getAll).toHaveBeenCalledWith('wilayas');
    expect(svc.getAll).toHaveBeenCalledWith('regions');

    comp.openCreate();
    comp.form.patchValue({ parentId: 1, code: 'CES', name: ' Central Equatoria ', nameAr: 'وسط' });
    comp.onSubmit();
    fixture.detectChanges();

    expect(svc.create).toHaveBeenCalledTimes(1);
    expect(svc.create).toHaveBeenCalledWith(
      'wilayas',
      expect.objectContaining({ regionId: 1, code: 'CES', name: 'Central Equatoria' }),
    );
    const [, payload] = svc.create.mock.calls[0] as unknown[];
    expect(payload).not.toHaveProperty('sortOrder');
  });

  it('refuses to save without a parent', () => {
    const { comp, svc } = setup(config('cities'));

    comp.openCreate();
    comp.form.patchValue({ code: 'JUBA', name: 'Juba', nameAr: 'جوبا' });
    comp.onSubmit();

    expect(svc.create).not.toHaveBeenCalled();
    expect(comp.form.controls.parentId.touched).toBe(true);
  });

  it('shows the sort order only for grades, and sends it (null when left empty)', () => {
    const { comp, svc, fixture, el } = setup(config('grades'));
    comp.openCreate();
    fixture.detectChanges();
    expect(el.querySelector('#ms-sort')).not.toBeNull();

    comp.form.patchValue({ code: 'G25', name: 'Grade 25', nameAr: 'x', sortOrder: 25 });
    comp.onSubmit();
    expect(svc.create).toHaveBeenLastCalledWith(
      'grades',
      expect.objectContaining({ sortOrder: 25 }),
    );

    comp.openCreate();
    comp.form.patchValue({ code: 'G26', name: 'Grade 26', nameAr: 'x' });
    comp.onSubmit();
    expect(svc.create).toHaveBeenLastCalledWith(
      'grades',
      expect.objectContaining({ sortOrder: null }),
    );
  });

  it('has no sort order field on a master without one', () => {
    const { comp, fixture, el } = setup(config('religions'));
    comp.openCreate();
    fixture.detectChanges();

    expect(el.querySelector('#ms-sort')).toBeNull();
  });

  it('does not save a sort order outside 0 to 9999 and shows the field error', () => {
    const { comp, svc, fixture, el } = setup(config('grades'));
    comp.openCreate();
    comp.form.patchValue({ code: 'G99', name: 'Grade 99', nameAr: 'x', sortOrder: 10000 });
    comp.onSubmit();
    fixture.detectChanges();

    expect(svc.create).not.toHaveBeenCalled();
    expect(el.querySelector('.field-error')).not.toBeNull();
  });
});
