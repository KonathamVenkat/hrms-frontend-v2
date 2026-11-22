// src/app/features/payroll/models/payroll.model.ts

export type ComponentType  = 'EARNING' | 'DEDUCTION' | 'STATUTORY';
export type CalculationType = 'FIXED' | 'PERCENTAGE_OF_BASIC' | 'PERCENTAGE_OF_GROSS' | 'FORMULA';

export interface SalaryComponentResponse {
  componentId:        number;
  componentCode:      string;
  componentName:      string;
  componentNameAr:    string;
  componentType:      ComponentType;
  componentTypeLabel: string;
  calcType:           CalculationType;
  calcTypeLabel:      string;
  defaultValue:       number;
  isTaxable:          boolean;
  isNssfApplicable:   boolean;
  description:        string | null;
  sortOrder:          number;
  isActive:           boolean;
  createdAt:          string;
  updatedAt:          string;
  version:            number;
}

export interface SalaryStructureItemResponse {
  itemId:            number;
  componentId:       number;
  componentCode:     string;
  componentName:     string;
  componentNameAr:   string;
  componentType:     ComponentType;
  effectiveCalcType: CalculationType;
  amount:            number;
  percentage:        number;
  sortOrder:         number;
}

export interface SalaryStructureResponse {
  structureId:    number;
  structureCode:  string;
  structureName:  string;
  description:    string | null;
  isActive:       boolean;
  items:          SalaryStructureItemResponse[];
  employeeCount:  number;
  createdAt:      string;
  updatedAt:      string;
  version:        number;
}

export interface SalaryBreakdownItem {
  componentCode:  string;
  componentName:  string;
  componentNameAr:string;
  componentType:  ComponentType;
  amount:         number;
  calcBasis:      string;
}

export interface EmployeeSalaryResponse {
  empSalaryId:      number;
  employeeId:       number;
  employeeCode:     string;
  employeeName:     string;
  designationName:  string | null;
  departmentName:   string | null;
  structureId:      number;
  structureName:    string;
  basicSalary:      number;
  grossSalary:      number;
  netSalary:        number;
  currency:         string;
  effectiveFrom:    string;
  effectiveTo:      string | null;
  isCurrent:        boolean;
  remarks:          string | null;
  breakdown:        SalaryBreakdownItem[];
  createdAt:        string;
  updatedAt:        string;
  /** Current record only: today's pay-scale amount for the employee's grade and increment (absent without a grade). */
  payScaleBasic?:   number;
  /** The allowances of this salary with the amounts it was given (absent when not paid). */
  socialAmount?:             number;
  qualificationLevelId?:     number;
  qualificationLevelName?:   string;
  qualificationLevelNameAr?: string;
  qualificationAmount?:      number;
  /** Current record only: what the employee's running loans take this month (absent when none). */
  loanInstalments?:          number;
}

// ── Loan register (payroll step 4b-1, /api/v1/payroll/loans, HR_ADMIN) ──
export type LoanStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED';

/** A salary component flagged as a loan type. */
export interface LoanType {
  id:     number;
  code:   string;
  name:   string;
  nameAr: string;
}

export interface EmployeeLoan {
  loanId:            number;
  employeeId:        number;
  employeeCode:      string;
  employeeName:      string;
  componentId:       number;
  componentCode:     string;
  loanTypeName:      string;
  loanTypeNameAr:    string;
  principal:         number;
  instalmentCount:   number;
  monthlyInstalment: number;
  /** The last instalment takes what is left after rounding the others down to the cent. */
  finalInstalment:   number;
  instalmentsPaid:   number;
  remainingBalance:  number;
  startMonth:        string;   // yyyy-MM-dd, first day of the month
  lastMonth:         string;
  status:            LoanStatus;
  statusReason?:     string;
  remarks?:          string;
  version:           number;
}

export interface EmployeeLoanRequest {
  employeeId:       number;
  componentId:      number;
  principal:        number;
  instalmentCount:  number;
  startMonth:       string;   // yyyy-MM
  /** For a loan already running when it is entered. */
  instalmentsPaid?: number;
  remarks?:         string;
}

export interface LoanSearch {
  q?:           string;
  componentId?: number | null;
  status?:      LoanStatus | null;
  page:         number;
  size:         number;
}

/** A qualification level and its monthly allowance (GET payroll/qualification-levels/lookup, HR_ADMIN). */
export interface QualificationLevel {
  id:            number;
  code:          string;
  name:          string;
  nameAr:        string;
  monthlyAmount: number;
  sortOrder?:    number;
  isActive:      boolean;
}

/** What the pay scale gives an employee's salary on a date (GET employee-salary/{id}/pay-scale, HR_ADMIN). */
export interface PayScaleBasis {
  graded:         boolean;
  onDate:         string;   // yyyy-MM-dd
  gradeId?:       number;
  gradeName?:     string;
  gradeNameAr?:   string;
  incrementNo?:   number;
  /** Absent when no structure is linked to the grade yet. */
  structureId?:   number;
  structureName?: string;
  /** Absent when the pay scale has no amount for the grade and increment on that date. */
  basicSalary?:   number;
}

// ── Request types ──────────────────────────────────────────
export interface SalaryComponentRequest {
  componentCode:     string;
  componentName:     string;
  componentNameAr:   string;
  componentType:     ComponentType;
  calcType:          CalculationType;
  defaultValue:      number;
  isTaxable?:        boolean;
  isNssfApplicable?: boolean;
  description?:      string;
  sortOrder?:        number;
  /** The version the screen was opened with; the server refuses an edit made from an older one. */
  version?:          number;
}

export interface SalaryStructureItemRequest {
  componentId:       number;
  calcTypeOverride?: CalculationType;
  amount?:           number;
  percentage?:       number;
  sortOrder?:        number;
}

export interface SalaryStructureRequest {
  structureCode: string;
  structureName: string;
  description?:  string;
  items:         SalaryStructureItemRequest[];
  /** The version the screen was opened with; the server refuses an edit made from an older one. */
  version?:      number;
}

export interface EmployeeSalaryRequest {
  employeeId:    number;
  structureId:   number;
  /** Required without a grade; left out for a graded employee (the server takes it from the pay scale). */
  basicSalary?:  number;
  effectiveFrom: string;   // yyyy-MM-dd
  remarks?:      string;
  /** Pays the Social Allowance component's default amount with this salary. */
  socialAllowance?:      boolean;
  /** An active qualification level, or null for none. */
  qualificationLevelId?: number | null;
}

// ── Display configs ────────────────────────────────────────
// `label` values are ngx-translate keys — reusing the existing `payroll.salaryComponent.types.*`
// / `payroll.salaryComponent.calcTypes.*` keys — templates must pipe them through `| translate`.
export const COMPONENT_TYPE_CONFIG: Record<ComponentType,
  { label: string; color: string; bg: string }> = {
  EARNING:   { label: 'payroll.salaryComponent.types.earning',   color: '#166534', bg: '#dcfce7' },
  DEDUCTION: { label: 'payroll.salaryComponent.types.deduction', color: '#991b1b', bg: '#fee2e2' },
  STATUTORY: { label: 'payroll.salaryComponent.types.statutory', color: '#92400e', bg: '#fef3c7' },
};

export const CALC_TYPE_LABELS: Record<CalculationType, string> = {
  FIXED:               'payroll.salaryComponent.calcTypes.fixed',
  PERCENTAGE_OF_BASIC: 'payroll.salaryComponent.calcTypes.percentOfBasic',
  PERCENTAGE_OF_GROSS: 'payroll.salaryComponent.calcTypes.percentOfGross',
  FORMULA:             'payroll.salaryComponent.calcTypes.formula',
};
