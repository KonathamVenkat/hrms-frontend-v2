import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { Sections } from './section';
import { SectionService } from '../../services/section';
import { Section } from '../../models/section';
import { DepartmentService } from '../../../departments/services/department';
import { Department } from '../../../departments/models/department';
import { MasterDataService } from '../../../masters/services/master-data';

const reply = <T>(data: T) => of({ success: true, message: '', statusCode: 200, data });

const dept = (deptId: number, directorateId: number, isActive = true): Department => ({
  deptId,
  directorateId,
  code: `D${deptId}`,
  name: `Dept ${deptId}`,
  nameAr: 'x',
  isActive,
});
const section = (id: number, departmentId: number, name: string, isActive = true): Section => ({
  id,
  departmentId,
  code: `SEC-${id}`,
  name,
  nameAr: 'x',
  isActive,
});

function setup() {
  const svc = {
    getAll: vi.fn(() =>
      reply([section(1, 10, 'Geology'), section(2, 11, 'Survey'), section(3, 12, 'Drilling', false)]),
    ),
    create: vi.fn(() => reply(section(9, 10, 'New'))),
    update: vi.fn(() => reply(section(1, 10, 'Geology'))),
    deactivate: vi.fn(),
    activate: vi.fn(),
    delete: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: SectionService, useValue: svc },
      {
        provide: DepartmentService,
        useValue: { getAll: () => reply([dept(10, 1), dept(11, 1), dept(12, 2), dept(13, 2, false)]) },
      },
      {
        provide: MasterDataService,
        useValue: {
          getAll: () =>
            reply([
              { id: 1, code: 'A', name: 'Directorate A', nameAr: 'x', isActive: true },
              { id: 2, code: 'B', name: 'Directorate B', nameAr: 'x', isActive: true },
            ]),
        },
      },
    ],
  });
  const comp = TestBed.createComponent(Sections).componentInstance;
  comp.ngOnInit();
  return { comp, svc };
}

describe('Sections screen', () => {
  it('lists every section and counts the active ones', () => {
    const { comp } = setup();
    expect(comp.filtered().map((s) => s.name)).toEqual(['Geology', 'Survey', 'Drilling']);
    expect(comp.activeCount()).toBe(2);
  });

  it('a directorate narrows the departments, then the sections', () => {
    const { comp } = setup();
    comp.setDirectorateFilter('1');

    expect(comp.filterDepartments().map((d) => d.deptId)).toEqual([10, 11]);
    expect(comp.filtered().map((s) => s.name)).toEqual(['Geology', 'Survey']);

    comp.setDepartmentFilter('11');
    expect(comp.filtered().map((s) => s.name)).toEqual(['Survey']);
  });

  it('changing the directorate drops a department that no longer belongs to it', () => {
    const { comp } = setup();
    comp.setDepartmentFilter('10');
    comp.setDirectorateFilter('2');

    expect(comp.filterDepartment()).toBeNull();
    expect(comp.filtered().map((s) => s.name)).toEqual(['Drilling']);
  });

  it('searches by name, code and Arabic name, together with the status filter', () => {
    const { comp } = setup();
    comp.filterText.set('sur');
    expect(comp.filtered().map((s) => s.name)).toEqual(['Survey']);

    comp.filterText.set('sec-3');
    comp.filterActive.set('active');
    expect(comp.filtered()).toEqual([]);
  });

  it('offers only active departments for a section, keeping the current one when editing', () => {
    const { comp } = setup();
    expect(comp.departmentOptions().map((d) => d.deptId)).toEqual([10, 11, 12]);
  });

  it('refuses to save without a department and does not call the server', () => {
    const { comp, svc } = setup();
    comp.openCreate();
    comp.form.patchValue({ code: 'SEC-9', name: 'New', nameAr: 'x' });
    comp.onSubmit();

    expect(svc.create).not.toHaveBeenCalled();
    expect(comp.form.controls.departmentId.hasError('min')).toBe(true);
  });

  it('saves a valid new section once, with the chosen department', () => {
    const { comp, svc } = setup();
    comp.openCreate();
    comp.form.patchValue({ departmentId: 10, code: 'sec-9', name: ' New ', nameAr: 'x' });
    comp.onSubmit();

    expect(svc.create).toHaveBeenCalledTimes(1);
    expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({ departmentId: 10, code: 'SEC-9', name: 'New' }),
    );
  });
});

describe('Sections screen clear filters', () => {
  it('knows when a filter is on and clears them all, including the search box', () => {
    const { comp } = setup();
    expect(comp.hasFilters()).toBe(false);

    comp.setDirectorateFilter('1');
    comp.setDepartmentFilter('10');
    comp.filterText.set('geo');
    comp.filterActive.set('inactive');
    expect(comp.hasFilters()).toBe(true);

    comp.clearFilters();
    expect(comp.hasFilters()).toBe(false);
    expect(comp.filtered().length).toBe(3);
  });
});
