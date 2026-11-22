import { ComponentType, SalaryStructureItemResponse } from '../../models/payroll.model';

/** An allowance of the employee (Social, Qualification): a fixed earning that is not in the structure. */
export interface PreviewExtra {
  code: string;
  name: string;
  amount: number;
}

export interface PreviewLine {
  code: string;
  name: string;
  type: ComponentType;
  /** How the amount is found: 'fixed', 'basic' or 'gross' (a percent of it) or 'payrollRun' (worked out later). */
  basis: 'fixed' | 'basic' | 'gross' | 'payrollRun';
  percent: number;
  amount: number;
}

export interface SalaryPreview {
  lines: PreviewLine[];
  gross: number;
  net: number;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * The salary the server will save, worked out the same way (EmployeeSalaryServiceImpl.calculateSalary): basic, the
 * employee's allowances, fixed and %-of-basic items make the gross; %-of-gross items are then taken on that gross;
 * net is gross minus deductions and statutory items. Formula items (income tax, absence) count as 0 until payroll run.
 */
export function salaryPreview(
  basic: number,
  extras: PreviewExtra[],
  items: SalaryStructureItemResponse[],
): SalaryPreview {
  const lines: PreviewLine[] = extras.map((e) => ({
    code: e.code,
    name: e.name,
    type: 'EARNING',
    basis: 'fixed',
    percent: 0,
    amount: e.amount,
  }));
  const structure = items.filter((i) => i.componentCode !== 'BASIC');
  for (const i of structure) {
    const base = {
      code: i.componentCode,
      name: i.componentName,
      type: i.componentType,
      percent: i.percentage,
    };
    switch (i.effectiveCalcType) {
      case 'FIXED':
        lines.push({ ...base, basis: 'fixed', amount: i.amount });
        break;
      case 'PERCENTAGE_OF_BASIC':
        lines.push({ ...base, basis: 'basic', amount: round3((basic * i.percentage) / 100) });
        break;
      case 'FORMULA':
        lines.push({ ...base, basis: 'payrollRun', amount: 0 });
        break;
      default:
        break; // % of gross: below, once the gross is known
    }
  }
  const sumOf = (type: ComponentType) =>
    lines.filter((l) => l.type === type).reduce((s, l) => s + l.amount, 0);
  const baseGross = basic + sumOf('EARNING');

  for (const i of structure.filter((x) => x.effectiveCalcType === 'PERCENTAGE_OF_GROSS')) {
    lines.push({
      code: i.componentCode,
      name: i.componentName,
      type: i.componentType,
      basis: 'gross',
      percent: i.percentage,
      // Gross-based earnings are taken on the gross without them, as on the server (no gross-of-gross loop).
      amount: round3((baseGross * i.percentage) / 100),
    });
  }
  const gross = round3(basic + sumOf('EARNING'));
  const net = round3(gross - sumOf('DEDUCTION') - sumOf('STATUTORY'));
  return { lines, gross, net };
}
