import {
  BANKS,
  BANK_BRANCHES,
  COMPANIES,
  COMPANY_BRANCHES,
  REFERENCE_MASTER_ROUTES,
} from './masters.config';

describe('masters.config', () => {
  const all = [
    BANKS,
    BANK_BRANCHES,
    COMPANIES,
    COMPANY_BRANCHES,
    ...REFERENCE_MASTER_ROUTES.map((r) => r.master),
  ];

  it('gives every reference master its own route path, endpoint and translation key', () => {
    const paths = REFERENCE_MASTER_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(all.map((m) => m.key)).size).toBe(all.length);
    REFERENCE_MASTER_ROUTES.forEach((r) => expect(r.master.endpoint).toBe(r.path));
  });

  it('points every parent at a master that exists', () => {
    const endpoints = new Set(all.map((m) => m.endpoint));
    all.forEach((m) => {
      if (m.parent) expect(endpoints.has(m.parent.endpoint)).toBe(true);
    });
  });

  it('keeps the geography chain region > wilaya > province > city', () => {
    const parentOf = (path: string) =>
      REFERENCE_MASTER_ROUTES.find((r) => r.path === path)?.master.parent?.endpoint;

    expect(parentOf('regions')).toBeUndefined();
    expect(parentOf('wilayas')).toBe('regions');
    expect(parentOf('provinces')).toBe('wilayas');
    expect(parentOf('cities')).toBe('provinces');
  });
});
