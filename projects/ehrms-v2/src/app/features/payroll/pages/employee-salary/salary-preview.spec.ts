import { salaryPreview } from './salary-preview';
import {
  CalculationType,
  ComponentType,
  SalaryStructureItemResponse,
} from '../../models/payroll.model';

let id = 0;
const item = (
  code: string,
  type: ComponentType,
  calc: CalculationType,
  value: number,
): SalaryStructureItemResponse => ({
  itemId: ++id,
  componentId: id,
  componentCode: code,
  componentName: code,
  componentNameAr: code,
  componentType: type,
  effectiveCalcType: calc,
  amount: calc === 'FIXED' ? value : 0,
  percentage: calc === 'FIXED' ? 0 : value,
  sortOrder: id,
});

/** The Grade 5 structure as stored on dev (2026-11-22), with Armed Forces at 1/30. */
const GRADE_5 = [
  item('COLA', 'EARNING', 'PERCENTAGE_OF_BASIC', 20),
  item('HRA', 'EARNING', 'PERCENTAGE_OF_BASIC', 20),
  item('NATURE_OF_WORK', 'EARNING', 'PERCENTAGE_OF_BASIC', 56),
  item('ADMIN_ALLOW', 'EARNING', 'PERCENTAGE_OF_BASIC', 49),
  item('TRANSFER_ALLOW', 'EARNING', 'PERCENTAGE_OF_BASIC', 35),
  item('PETROL', 'EARNING', 'FIXED', 337500),
  item('INSURANCE', 'STATUTORY', 'PERCENTAGE_OF_GROSS', 8),
  item('ARMED_FORCES', 'STATUTORY', 'PERCENTAGE_OF_GROSS', 3.3333333333),
  item('INCOME_TAX', 'STATUTORY', 'FORMULA', 0),
];

describe('salaryPreview', () => {
  it('gives the same gross and net as the server for Grade 5, increment 1', () => {
    const p = salaryPreview(700306, [], GRADE_5);
    expect(p.gross).toBe(2298356.8);
    // 2,298,356.80 - 8% (183,868.544) - 1/30 (76,611.893) = 2,037,876.363 (server test armedForcesAtOneThirtieth...)
    expect(p.net).toBe(2037876.363);
    expect(p.lines.find((l) => l.code === 'INSURANCE')).toEqual(
      expect.objectContaining({ basis: 'gross', amount: 183868.544 }),
    );
    expect(p.lines.find((l) => l.code === 'INCOME_TAX')).toEqual(
      expect.objectContaining({ basis: 'payrollRun', amount: 0 }),
    );
  });

  it('counts Social and Qualification in gross, so Insurance and Armed Forces are taken on them too', () => {
    const p = salaryPreview(
      700306,
      [
        { code: 'SOCIAL_ALLOW', name: 'Social Allowance', amount: 135000 },
        { code: 'QUALIFICATION', name: 'Qualification Allowance', amount: 202500 },
      ],
      GRADE_5,
    );
    expect(p.gross).toBe(2635856.8);
    expect(p.lines.slice(0, 2).map((l) => l.code)).toEqual(['SOCIAL_ALLOW', 'QUALIFICATION']);
    expect(p.lines.find((l) => l.code === 'INSURANCE')?.amount).toBe(210868.544);
  });

  it('a basic line in the structure is not counted twice, and an empty structure is just the basic', () => {
    const withBasic = salaryPreview(1000, [], [item('BASIC', 'EARNING', 'FIXED', 1000)]);
    expect(withBasic.gross).toBe(1000);
    expect(salaryPreview(1000, [], [])).toEqual({ lines: [], gross: 1000, net: 1000 });
  });
});
