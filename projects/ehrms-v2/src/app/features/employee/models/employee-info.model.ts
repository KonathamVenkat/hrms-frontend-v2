/**
 * Mirrors the Response and Request records of /api/v1/employees/{id}/<section> for the six employee-information
 * sections (dependants, education, training, languages, experience, references). The backend omits empty values, so
 * every optional property may be missing.
 */
export type InfoGender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

/** Fields every record has; the index signature lets the generic section read a field by its name. */
export interface InfoRecord {
  id: number;
  employeeId: number;
  isActive: boolean;
  version: number;
  [field: string]: string | number | boolean | undefined;
}

export interface DependantRecord extends InfoRecord {
  relationId: number;
  relationName?: string;
  relationNameAr?: string;
  firstName: string;
  middleName?: string;
  lastName?: string;
  firstNameAr?: string;
  middleNameAr?: string;
  lastNameAr?: string;
  gender?: InfoGender;
  dateOfBirth?: string;
  birthPlace?: string;
  isAlive?: boolean;
  phone?: string;
  address?: string;
}

export interface EducationRecord extends InfoRecord {
  educationLevelId?: number;
  educationLevelName?: string;
  educationLevelNameAr?: string;
  qualification: string;
  qualificationAr?: string;
  institution?: string;
  startDate?: string;
  endDate?: string;
}

export interface TrainingRecord extends InfoRecord {
  courseName: string;
  courseNameAr?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
}

export interface LanguageRecord extends InfoRecord {
  languageId: number;
  languageName?: string;
  languageNameAr?: string;
  readLevelId?: number;
  readLevelName?: string;
  readLevelNameAr?: string;
  writeLevelId?: number;
  writeLevelName?: string;
  writeLevelNameAr?: string;
  speakLevelId?: number;
  speakLevelName?: string;
  speakLevelNameAr?: string;
}

export interface ExperienceRecord extends InfoRecord {
  employerName: string;
  employerNameAr?: string;
  jobTitle?: string;
  place?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReferenceRecord extends InfoRecord {
  firstName: string;
  middleName?: string;
  lastName?: string;
  firstNameAr?: string;
  middleNameAr?: string;
  lastNameAr?: string;
  jobTitle?: string;
  address?: string;
  phone?: string;
  email?: string;
}

/** What the form sends: one value per field of the section, plus the version when editing. */
export interface InfoPayload {
  [field: string]: string | number | boolean | null | undefined;
  version?: number;
}

/** One row of GET /api/v1/lookups/{kind} (MasterLookupResponse). */
export interface InfoLookup {
  id: number;
  code: string;
  name: string;
  nameAr: string;
  /** A dependent master's parent id (a city's province); absent otherwise. */
  parentId?: number;
}

export type LookupKind = 'relations' | 'languages' | 'language-levels' | 'education-levels';
