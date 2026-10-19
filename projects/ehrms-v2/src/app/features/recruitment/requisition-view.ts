import { RequisitionStatus } from './models/requisition.model';

export type RequisitionAction =
  | 'edit'
  | 'submit'
  | 'cancel'
  | 'approve'
  | 'reject'
  | 'hold'
  | 'resume'
  | 'close';

export interface ActionContext {
  /** HR_ADMIN or HR_MANAGER. */
  isHr: boolean;
  /** The signed-in employee raised this requisition. */
  isRequester: boolean;
}

/**
 * The buttons to offer for a requisition. This only decides what to show: the API checks the role, the
 * requester, the state and the version again on every call and answers 403 or 409 when a rule is broken.
 */
export function availableActions(
  status: RequisitionStatus,
  ctx: ActionContext,
): RequisitionAction[] {
  const mayHandle = ctx.isHr || ctx.isRequester;
  switch (status) {
    case 'DRAFT':
      return mayHandle ? ['edit', 'submit', 'cancel'] : [];
    case 'PENDING_APPROVAL': {
      const actions: RequisitionAction[] = [];
      // Nobody decides on their own requisition.
      if (ctx.isHr && !ctx.isRequester) actions.push('approve', 'reject');
      if (mayHandle) actions.push('cancel');
      return actions;
    }
    case 'APPROVED':
      return ctx.isHr ? ['hold', 'close', 'cancel'] : [];
    case 'ON_HOLD':
      return ctx.isHr ? ['resume', 'close', 'cancel'] : [];
    default:
      return [];
  }
}

/** Shared status-badge class (see styles.css): green approved, amber waiting, red refused, grey finished or draft. */
export function statusBadgeClass(status: RequisitionStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'status-active';
    case 'PENDING_APPROVAL':
    case 'ON_HOLD':
      return 'status-pending';
    case 'REJECTED':
      return 'status-rejected';
    case 'FILLED':
      return 'status-approved';
    default:
      return 'status-inactive'; // DRAFT, CLOSED, CANCELLED
  }
}
