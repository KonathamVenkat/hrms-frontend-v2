import {
  CardContext,
  DEPENDANTS,
  EDUCATION,
  EXPERIENCE,
  LANGUAGES,
  REFERENCES,
  TRAINING,
} from './employee-info.config';
import { DependantRecord, LanguageRecord } from '../../models/employee-info.model';

const record = { id: 1, employeeId: 10, isActive: true, version: 0 };

function context(lang: 'en' | 'ar'): CardContext {
  return {
    date: (v) => (v ? `D(${v})` : '—'),
    name: (en, ar) => (lang === 'ar' && ar ? ar : (en ?? ar ?? '')),
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  };
}

describe('employee-info.config', () => {
  it('puts every field of every section under its own translation key and a known type', () => {
    for (const section of [DEPENDANTS, EDUCATION, TRAINING, LANGUAGES, EXPERIENCE, REFERENCES]) {
      const names = section.fields.map((f) => f.name);
      expect(new Set(names).size).toBe(names.length);
      section.fields.forEach((f) => expect(f.labelKey).toBe(`employee.info.fields.${f.name}`));
      section.fields
        .filter((f) => f.type === 'select')
        .forEach((f) => expect(f.lookup).toBeDefined());
      if (section.dateRange) {
        expect(names).toContain(section.dateRange.from);
        expect(names).toContain(section.dateRange.to);
      }
    }
  });

  it('mirrors the backend lengths: required names and Arabic fields', () => {
    const byName = (name: string) => DEPENDANTS.fields.find((f) => f.name === name);

    expect(byName('firstName')).toMatchObject({ required: true, max: 100 });
    expect(byName('firstNameAr')).toMatchObject({ type: 'arabic', max: 200 });
    expect(byName('birthPlace')?.max).toBe(80);
    expect(byName('dateOfBirth')?.noFuture).toBe(true);
    expect(byName('relationId')).toMatchObject({ required: true, lookup: 'relations' });
  });

  it('shows a dependant with both names, the relation as a chip and what is known about them', () => {
    const r: DependantRecord = {
      ...record,
      relationId: 1,
      relationName: 'Spouse',
      relationNameAr: 'زوج',
      firstName: 'Rose',
      lastName: 'Lado',
      firstNameAr: 'روز',
      lastNameAr: 'لادو',
      dateOfBirth: '1990-07-04',
      gender: 'FEMALE',
      phone: '+211 912 000 000',
      isAlive: false,
    };

    const en = DEPENDANTS.card(r, context('en'));
    const ar = DEPENDANTS.card(r, context('ar'));

    expect(en.title).toBe('Rose Lado');
    expect(en.titleAr).toBe('روز لادو');
    expect(en.chips).toEqual(['Spouse', 'employee.info.deceased']);
    expect(ar.chips[0]).toBe('زوج');
    expect(en.meta).toContain('employee.info.gender.FEMALE');
    expect(en.meta).toContain('+211 912 000 000');
  });

  it('writes a period with "present" for an open end and nothing when no date is known', () => {
    const open = EXPERIENCE.card(
      { ...record, employerName: 'Ministry', startDate: '2012-07-01' },
      context('en'),
    );
    const closed = EDUCATION.card(
      {
        ...record,
        qualification: 'BSc',
        startDate: '2008-09-01',
        endDate: '2012-06-30',
        institution: 'University of Juba',
      },
      context('en'),
    );
    const undated = TRAINING.card({ ...record, courseName: 'HSE' }, context('en'));

    expect(open.meta).toEqual(['D(2012-07-01) – employee.info.present']);
    expect(closed.meta).toEqual(['University of Juba', 'D(2008-09-01) – D(2012-06-30)']);
    expect(undated.meta).toEqual([]);
  });

  it("shows a language with a chip per known level, in the user's language", () => {
    const r: LanguageRecord = {
      ...record,
      languageId: 1,
      languageName: 'English',
      languageNameAr: 'الإنجليزية',
      readLevelName: 'Fluent',
      readLevelNameAr: 'طليق',
      speakLevelName: 'Basic',
    };

    expect(LANGUAGES.card(r, context('en')).chips).toEqual([
      'employee.info.read: Fluent',
      'employee.info.speak: Basic',
    ]);
    expect(LANGUAGES.card(r, context('ar')).chips[0]).toBe('employee.info.read: طليق');
    expect(LANGUAGES.card(r, context('en')).titleAr).toBe('الإنجليزية');
  });

  it('shows a reference with job title, phone and e-mail', () => {
    const view = REFERENCES.card(
      {
        ...record,
        firstName: 'John',
        lastName: 'Deng',
        jobTitle: 'Director',
        phone: '+211 1',
        email: 'j@x.test',
      },
      context('en'),
    );

    expect(view.title).toBe('John Deng');
    expect(view.meta).toEqual(['Director', '+211 1', 'j@x.test']);
  });
});
