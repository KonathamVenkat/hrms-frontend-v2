/** Mirrors StageRequest/StageResponse and RejectionReasonRequest/RejectionReasonResponse of the employee service. */

export type StageType = 'OPEN' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
export type ReasonScope = 'APPLICATION' | 'OFFER';

export const STAGE_TYPES: readonly StageType[] = ['OPEN', 'HIRED', 'REJECTED', 'WITHDRAWN'];
export const REASON_SCOPES: readonly ReasonScope[] = ['APPLICATION', 'OFFER'];

export interface Stage {
  id: number;
  code: string;
  name: string;
  nameAr: string;
  stageType: StageType;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  version: number;
}

export interface StageRequest {
  code: string;
  name: string;
  nameAr: string;
  stageType: StageType;
  sortOrder: number;
  isActive?: boolean;
  version?: number;
}

export interface RejectionReason {
  id: number;
  code: string;
  name: string;
  nameAr: string;
  appliesTo: ReasonScope;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  version: number;
}

export interface RejectionReasonRequest {
  code: string;
  name: string;
  nameAr: string;
  appliesTo: ReasonScope;
  sortOrder: number;
  isActive?: boolean;
  version?: number;
}
