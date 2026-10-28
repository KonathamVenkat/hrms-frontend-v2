/** Mirrors the records in com.hrms.workflow.dto (RequestType, StepOutcome, HistoryAction). */
export const REQUEST_TYPES = [
  'LEAVE',
  'ATTENDANCE_REGULARIZATION',
  'OVERTIME',
  'RECRUITMENT_REQUISITION',
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

/** True for a request type this app knows (e.g. a route parameter). */
export function isRequestType(value: string | null): value is RequestType {
  return (REQUEST_TYPES as readonly (string | null)[]).includes(value);
}
export type StepOutcome = 'FORWARD' | 'APPROVE' | 'REJECT';
export type HistoryAction =
  | 'SUBMITTED'
  | 'FORWARDED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'OVERRIDDEN'
  | 'AUTO_ROUTED';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number?: number;
  pageNumber?: number;
  size?: number;
  pageSize?: number;
}

/** WorkflowStatusResponse. Step fields are absent once the request is closed. */
export interface WorkflowStatus {
  type: RequestType;
  requestId: number;
  stage: string;
  stepKey?: string;
  stepLabelEn?: string;
  stepLabelAr?: string;
  allowedOutcomes: StepOutcome[];
  pickTargetDepartment: boolean;
  requesterEmployeeId: number;
  requesterName?: string;
  summary?: string;
  /** The caller (an HR_ADMIN, not the requester) may override the open step now. False once closed. */
  mayOverride: boolean;
  /** The open step picks the department, so an override that forwards must send one. */
  overridePicksTargetDepartment: boolean;
}

/** RequestHistoryResponse. Actor fields are absent on system rows (AUTO_ROUTED); stepKey on the SUBMITTED row. */
export interface RequestHistory {
  stepKey?: string;
  action: HistoryAction;
  actorEmployeeId?: number;
  actorName?: string;
  actorRole?: string;
  comment?: string;
  actedAt: string;
}

/** InboxItemResponse. */
export interface InboxItem {
  type: RequestType;
  requestId: number;
  stepKey: string;
  stepLabelEn: string;
  stepLabelAr: string;
  requesterEmployeeId: number;
  requesterName?: string;
  summary?: string;
  submittedAt: string;
}

/** WorkflowActionRequest: null, never '', for what was not given. */
export interface WorkflowActionRequest {
  stepKey: string;
  outcome: StepOutcome;
  targetDepartmentId: number | null;
  comment: string | null;
}

/** WorkflowOverrideRequest (HR_ADMIN only). */
export interface WorkflowOverrideRequest {
  stepKey: string;
  outcome: StepOutcome;
  targetDepartmentId: number | null;
  reason: string;
}

const KNOWN_STAGES = [
  'PENDING_BRANCH',
  'PENDING_SECRETARY',
  'PENDING_HEAD',
  'PENDING_GM',
  'PENDING_HR',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

/** Translation key for a stage; a stage this screen does not know gets a generic text, never a raw key. */
export function stageKey(stage: string): string {
  return KNOWN_STAGES.includes(stage) ? `workflow.stages.${stage}` : 'workflow.stages.UNKNOWN';
}
