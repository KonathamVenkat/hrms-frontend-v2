import {
  DependantRecord,
  EducationRecord,
  ExperienceRecord,
  InfoRecord,
  LanguageRecord,
  LookupKind,
  ReferenceRecord,
  TrainingRecord,
} from '../../models/employee-info.model';

export type FieldType =
  | 'text'
  | 'arabic'
  | 'phone'
  | 'email'
  | 'date'
  | 'select'
  | 'gender'
  | 'checkbox';

export interface FieldConfig {
  /** Property of the request and response record. */
  name: string;
  /** Translation key of the label. */
  labelKey: string;
  type: FieldType;
  required?: boolean;
  /** Longest text, mirroring the backend and the column. */
  max?: number;
  /** Reference list behind a `select`. */
  lookup?: LookupKind;
  /** A date that cannot be in the future (date of birth). */
  noFuture?: boolean;
  /** Takes the whole row of the form instead of half of it. */
  wide?: boolean;
}

/** What the card of one record shows. */
export interface CardView {
  title: string;
  titleAr?: string;
  meta: string[];
  chips: string[];
}

/** Language-aware helpers the card functions use, so a config stays plain data and functions. */
export interface CardContext {
  date(value: string | undefined): string;
  /** The Arabic name in Arabic, the English one otherwise (falling back to whichever exists). */
  name(en: string | undefined, ar: string | undefined): string;
  t(key: string, params?: Record<string, string | number>): string;
}

export interface SectionConfig<R extends InfoRecord> {
  /** Translation block employee.info.<key>.* */
  key: string;
  /** Path under /api/v1/employees/{id}/. */
  endpoint: string;
  icon: string;
  fields: readonly FieldConfig[];
  /** Two date fields where the end cannot be before the start. */
  dateRange?: { from: string; to: string };
  card(record: R, ctx: CardContext): CardView;
}

const label = (name: string) => `employee.info.fields.${name}`;

const text = (name: string, max: number, extra: Partial<FieldConfig> = {}): FieldConfig => ({
  name,
  labelKey: label(name),
  type: 'text',
  max,
  ...extra,
});
const arabic = (name: string): FieldConfig => ({
  name,
  labelKey: label(name),
  type: 'arabic',
  max: 200,
});
const date = (name: string, extra: Partial<FieldConfig> = {}): FieldConfig => ({
  name,
  labelKey: label(name),
  type: 'date',
  ...extra,
});
const select = (name: string, lookup: LookupKind, required = false): FieldConfig => ({
  name,
  labelKey: label(name),
  type: 'select',
  lookup,
  required,
});

const join = (...parts: (string | undefined)[]): string =>
  parts
    .filter((p): p is string => !!p)
    .join(' ')
    .trim();

/** "05 Jan 2012 – 30 Jun 2016", "05 Jan 2012 – present", or nothing when neither date is known. */
const period = (ctx: CardContext, start?: string, end?: string): string[] =>
  start || end
    ? [`${start ? ctx.date(start) : '…'} – ${end ? ctx.date(end) : ctx.t('employee.info.present')}`]
    : [];

const present = (...items: (string | undefined)[]): string[] =>
  items.filter((i): i is string => !!i);

export const DEPENDANTS: SectionConfig<DependantRecord> = {
  key: 'dependants',
  endpoint: 'dependants',
  icon: 'people',
  fields: [
    select('relationId', 'relations', true),
    text('firstName', 100, { required: true }),
    text('middleName', 100),
    text('lastName', 100),
    arabic('firstNameAr'),
    arabic('middleNameAr'),
    arabic('lastNameAr'),
    { name: 'gender', labelKey: label('gender'), type: 'gender' },
    date('dateOfBirth', { noFuture: true }),
    text('birthPlace', 80),
    { name: 'phone', labelKey: label('phone'), type: 'phone', max: 30 },
    text('address', 200, { wide: true }),
    { name: 'isAlive', labelKey: label('isAlive'), type: 'checkbox' },
  ],
  card: (r, ctx) => ({
    title: join(r.firstName, r.middleName, r.lastName),
    titleAr: join(r.firstNameAr, r.middleNameAr, r.lastNameAr) || undefined,
    meta: present(
      r.dateOfBirth ? ctx.t('employee.info.born', { date: ctx.date(r.dateOfBirth) }) : undefined,
      r.gender ? ctx.t(`employee.info.gender.${r.gender}`) : undefined,
      r.birthPlace,
      r.phone,
    ),
    chips: present(
      ctx.name(r.relationName, r.relationNameAr) || undefined,
      r.isAlive === false ? ctx.t('employee.info.deceased') : undefined,
    ),
  }),
};

export const EDUCATION: SectionConfig<EducationRecord> = {
  key: 'education',
  endpoint: 'education',
  icon: 'school',
  fields: [
    select('educationLevelId', 'education-levels'),
    text('qualification', 200, { required: true, wide: true }),
    { ...arabic('qualificationAr'), wide: true },
    text('institution', 200, { wide: true }),
    date('startDate'),
    date('endDate'),
  ],
  dateRange: { from: 'startDate', to: 'endDate' },
  card: (r, ctx) => ({
    title: r.qualification,
    titleAr: r.qualificationAr,
    meta: present(r.institution, ...period(ctx, r.startDate, r.endDate)),
    chips: present(ctx.name(r.educationLevelName, r.educationLevelNameAr) || undefined),
  }),
};

export const TRAINING: SectionConfig<TrainingRecord> = {
  key: 'training',
  endpoint: 'training',
  icon: 'workspace_premium',
  fields: [
    text('courseName', 200, { required: true, wide: true }),
    { ...arabic('courseNameAr'), wide: true },
    text('provider', 200, { wide: true }),
    date('startDate'),
    date('endDate'),
  ],
  dateRange: { from: 'startDate', to: 'endDate' },
  card: (r, ctx) => ({
    title: r.courseName,
    titleAr: r.courseNameAr,
    meta: present(r.provider, ...period(ctx, r.startDate, r.endDate)),
    chips: [],
  }),
};

export const LANGUAGES: SectionConfig<LanguageRecord> = {
  key: 'languages',
  endpoint: 'languages',
  icon: 'translate',
  fields: [
    { ...select('languageId', 'languages', true), wide: true },
    select('readLevelId', 'language-levels'),
    select('writeLevelId', 'language-levels'),
    select('speakLevelId', 'language-levels'),
  ],
  card: (r, ctx) => {
    const level = (key: string, en?: string, ar?: string): string | undefined => {
      const name = ctx.name(en, ar);
      return name ? `${ctx.t(key)}: ${name}` : undefined;
    };
    return {
      title: r.languageName ?? '',
      titleAr: r.languageNameAr,
      meta: [],
      chips: present(
        level('employee.info.read', r.readLevelName, r.readLevelNameAr),
        level('employee.info.write', r.writeLevelName, r.writeLevelNameAr),
        level('employee.info.speak', r.speakLevelName, r.speakLevelNameAr),
      ),
    };
  },
};

export const EXPERIENCE: SectionConfig<ExperienceRecord> = {
  key: 'experience',
  endpoint: 'experience',
  icon: 'business_center',
  fields: [
    text('employerName', 200, { required: true, wide: true }),
    { ...arabic('employerNameAr'), wide: true },
    text('jobTitle', 100),
    text('place', 100),
    date('startDate'),
    date('endDate'),
  ],
  dateRange: { from: 'startDate', to: 'endDate' },
  card: (r, ctx) => ({
    title: r.employerName,
    titleAr: r.employerNameAr,
    meta: present(r.jobTitle, r.place, ...period(ctx, r.startDate, r.endDate)),
    chips: [],
  }),
};

export const REFERENCES: SectionConfig<ReferenceRecord> = {
  key: 'references',
  endpoint: 'references',
  icon: 'contact_phone',
  fields: [
    text('firstName', 100, { required: true }),
    text('middleName', 100),
    text('lastName', 100),
    arabic('firstNameAr'),
    arabic('middleNameAr'),
    arabic('lastNameAr'),
    text('jobTitle', 80),
    { name: 'phone', labelKey: label('phone'), type: 'phone', max: 30 },
    { name: 'email', labelKey: label('email'), type: 'email', max: 200, wide: true },
    text('address', 200, { wide: true }),
  ],
  card: (r) => ({
    title: join(r.firstName, r.middleName, r.lastName),
    titleAr: join(r.firstNameAr, r.middleNameAr, r.lastNameAr) || undefined,
    meta: present(r.jobTitle, r.phone, r.email),
    chips: [],
  }),
};
