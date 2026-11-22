import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { GradeIncrementFields, GradePlace } from './grade-increment';
import { JobDetailsService } from '../../services/job-details.service';
import { GradeScaleStep } from '../../models/job-details.model';

const step = (gradeId: number, incrementNo: number, startingScale: number): GradeScaleStep => ({
  gradeId,
  gradeCode: `GRADE_0${gradeId}`,
  gradeName: `Grade ${gradeId}`,
  gradeNameAr: 'x',
  incrementNo,
  startingScale,
  effectiveFrom: '2026-03-01',
});
const SCALE = [step(8, 1, 460462), step(8, 2, 483485), step(9, 1, 400000)];

async function setup(
  opts: {
    locked?: boolean;
    current?: GradePlace | null;
    grade?: number | null;
    fails?: boolean;
  } = {},
) {
  const svc = {
    getGradeScale: vi.fn(() =>
      opts.fails
        ? throwError(() => new Error('403'))
        : of({ success: true, message: '', statusCode: 200, data: SCALE }),
    ),
  };
  TestBed.configureTestingModule({
    providers: [provideTranslateService(), { provide: JobDetailsService, useValue: svc }],
  });
  const grade = new FormControl<number | null>(opts.grade ?? null);
  const increment = new FormControl<number | null>(opts.grade ? 1 : null);
  const fixture = TestBed.createComponent(GradeIncrementFields);
  fixture.componentRef.setInput('gradeControl', grade);
  fixture.componentRef.setInput('incrementControl', increment);
  fixture.componentRef.setInput('locked', opts.locked ?? false);
  fixture.componentRef.setInput('current', opts.current ?? null);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    comp: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
    svc,
    grade,
    increment,
  };
}

describe('GradeIncrementFields', () => {
  it('offers each grade once and the increments of the chosen grade with their starting scale', async () => {
    const { comp, el, grade } = await setup();
    expect(comp.grades().map((g) => g.gradeId)).toEqual([8, 9]);
    expect(comp.increments()).toEqual([]);

    grade.setValue(8);
    expect(comp.increments()).toEqual([
      { incrementNo: 1, startingScale: 460462 },
      { incrementNo: 2, startingScale: 483485 },
    ]);
    expect(el.querySelector('#jd-grade-id')).not.toBeNull();
  });

  it('clears the increment when another grade is chosen', async () => {
    const { grade, increment } = await setup({ grade: 8 });
    expect(increment.value).toBe(1);
    grade.setValue(9);
    expect(increment.value).toBeNull();
  });

  it('while locked loads nothing and still shows the saved grade and increment', async () => {
    const saved = { gradeId: 7, gradeName: 'Grade 7', incrementNo: 4 };
    const { comp, svc } = await setup({ locked: true, current: saved, grade: 7 });
    expect(svc.getGradeScale).not.toHaveBeenCalled();
    expect(comp.grades()).toEqual([{ gradeId: 7, gradeName: 'Grade 7' }]);
    expect(comp.increments()).toEqual([{ incrementNo: 4, startingScale: null }]);
  });

  it('says so when the pay scale cannot be loaded, and keeps the saved value selectable', async () => {
    const saved = { gradeId: 8, gradeName: 'Grade 8', incrementNo: 1 };
    const { comp, el } = await setup({ fails: true, current: saved, grade: 8 });
    expect(comp.scale.error()).toBeTruthy();
    expect(comp.grades()).toEqual([{ gradeId: 8, gradeName: 'Grade 8' }]);
    expect(el.querySelector('#jd-grade-hint')).not.toBeNull();
    expect(el.querySelector('#jd-grade-id')?.getAttribute('aria-describedby')).toBe(
      'jd-grade-hint',
    );
  });

  it('ties a shown error to its field', async () => {
    const fixtureSetup = await setup({ grade: 8 });
    const fixture = TestBed.createComponent(GradeIncrementFields);
    fixture.componentRef.setInput('gradeControl', fixtureSetup.grade);
    fixture.componentRef.setInput('incrementControl', fixtureSetup.increment);
    fixture.componentRef.setInput('incrementError', 'Choose the increment');
    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector('#jd-increment-no');
    expect(select?.getAttribute('aria-invalid')).toBe('true');
    expect(select?.getAttribute('aria-describedby')).toBe('fe-incrementNo');
    expect(select?.getAttribute('aria-required')).toBe('true');
  });
});
