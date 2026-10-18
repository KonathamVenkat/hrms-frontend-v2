export type MasterKey = 'banks' | 'bankBranches' | 'companies' | 'companyBranches';
export type ParentField = 'bankId' | 'companyId';

/** One entry per master screen; the route's data hands it to the shared MasterData page. */
export interface MasterConfig {
  /** Translation block: admin.masters.<key>.* */
  key: MasterKey;
  /** Path under /api/v1/admin/. */
  endpoint: string;
  icon: string;
  parent?: { endpoint: string; field: ParentField };
}

export const BANKS: MasterConfig = { key: 'banks', endpoint: 'banks', icon: 'account_balance' };
export const BANK_BRANCHES: MasterConfig = {
  key: 'bankBranches',
  endpoint: 'bank-branches',
  icon: 'store',
  parent: { endpoint: 'banks', field: 'bankId' },
};
export const COMPANIES: MasterConfig = { key: 'companies', endpoint: 'companies', icon: 'domain' };
export const COMPANY_BRANCHES: MasterConfig = {
  key: 'companyBranches',
  endpoint: 'company-branches',
  icon: 'corporate_fare',
  parent: { endpoint: 'companies', field: 'companyId' },
};
