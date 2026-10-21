export type MasterKey =
  | 'banks'
  | 'bankBranches'
  | 'companies'
  | 'companyBranches'
  | 'regions'
  | 'wilayas'
  | 'provinces'
  | 'cities'
  | 'religions'
  | 'nationalities'
  | 'contractTypes'
  | 'professions'
  | 'educationLevels'
  | 'languages'
  | 'languageLevels'
  | 'houseTypes'
  | 'relationTypes'
  | 'relations'
  | 'directorates'
  | 'grades';
export type ParentField =
  | 'bankId'
  | 'companyId'
  | 'regionId'
  | 'wilayaId'
  | 'provinceId'
  | 'relationTypeId'
  | 'companyBranchId';

/** One entry per master screen; the route's data hands it to the shared MasterData page. */
export interface MasterConfig {
  /** Translation block: admin.masters.<key>.* */
  key: MasterKey;
  /** Path under /api/v1/admin/. */
  endpoint: string;
  icon: string;
  parent?: { endpoint: string; field: ParentField };
  /** The master has an optional sort order (grades), shown and edited on the screen. */
  sortOrder?: boolean;
  /** The list is long: the server pages, searches and filters it (GET <endpoint>/search). */
  paged?: boolean;
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

/** The reference masters: geography (region > wilaya > province > city), employee lists, directorates and grades. */
const REGIONS: MasterConfig = { key: 'regions', endpoint: 'regions', icon: 'public' };
const WILAYAS: MasterConfig = {
  key: 'wilayas',
  endpoint: 'wilayas',
  icon: 'map',
  parent: { endpoint: 'regions', field: 'regionId' },
};
const PROVINCES: MasterConfig = {
  key: 'provinces',
  endpoint: 'provinces',
  icon: 'terrain',
  parent: { endpoint: 'wilayas', field: 'wilayaId' },
};
const CITIES: MasterConfig = {
  key: 'cities',
  endpoint: 'cities',
  icon: 'location_city',
  parent: { endpoint: 'provinces', field: 'provinceId' },
  paged: true,
};
const RELIGIONS: MasterConfig = { key: 'religions', endpoint: 'religions', icon: 'menu_book' };
const NATIONALITIES: MasterConfig = {
  key: 'nationalities',
  endpoint: 'nationalities',
  icon: 'flag',
};
const CONTRACT_TYPES: MasterConfig = {
  key: 'contractTypes',
  endpoint: 'contract-types',
  icon: 'description',
};
const PROFESSIONS: MasterConfig = { key: 'professions', endpoint: 'professions', icon: 'work' };
const EDUCATION_LEVELS: MasterConfig = {
  key: 'educationLevels',
  endpoint: 'education-levels',
  icon: 'school',
};
const LANGUAGES: MasterConfig = { key: 'languages', endpoint: 'languages', icon: 'translate' };
const LANGUAGE_LEVELS: MasterConfig = {
  key: 'languageLevels',
  endpoint: 'language-levels',
  icon: 'bar_chart',
  sortOrder: true,
};
const HOUSE_TYPES: MasterConfig = { key: 'houseTypes', endpoint: 'house-types', icon: 'home' };
const RELATION_TYPES: MasterConfig = {
  key: 'relationTypes',
  endpoint: 'relation-types',
  icon: 'people',
};
const RELATIONS: MasterConfig = {
  key: 'relations',
  endpoint: 'relations',
  icon: 'group',
  parent: { endpoint: 'relation-types', field: 'relationTypeId' },
};
const DIRECTORATES: MasterConfig = {
  key: 'directorates',
  endpoint: 'directorates',
  icon: 'business',
  parent: { endpoint: 'company-branches', field: 'companyBranchId' },
};
const GRADES: MasterConfig = {
  key: 'grades',
  endpoint: 'grades',
  icon: 'trending_up',
  sortOrder: true,
};

/** Route path (under /app/admin), tab title and screen config of each reference master. */
export const REFERENCE_MASTER_ROUTES: { path: string; title: string; master: MasterConfig }[] = [
  { path: 'regions', title: 'Regions', master: REGIONS },
  { path: 'wilayas', title: 'Wilayas', master: WILAYAS },
  { path: 'provinces', title: 'Provinces', master: PROVINCES },
  { path: 'cities', title: 'Cities', master: CITIES },
  { path: 'religions', title: 'Religions', master: RELIGIONS },
  { path: 'nationalities', title: 'Nationalities', master: NATIONALITIES },
  { path: 'contract-types', title: 'Contract Types', master: CONTRACT_TYPES },
  { path: 'professions', title: 'Professions', master: PROFESSIONS },
  { path: 'education-levels', title: 'Education Levels', master: EDUCATION_LEVELS },
  { path: 'languages', title: 'Languages', master: LANGUAGES },
  { path: 'language-levels', title: 'Language Levels', master: LANGUAGE_LEVELS },
  { path: 'house-types', title: 'House Types', master: HOUSE_TYPES },
  { path: 'relation-types', title: 'Relation Types', master: RELATION_TYPES },
  { path: 'relations', title: 'Relations', master: RELATIONS },
  { path: 'directorates', title: 'Directorates', master: DIRECTORATES },
  { path: 'grades', title: 'Grades', master: GRADES },
];
