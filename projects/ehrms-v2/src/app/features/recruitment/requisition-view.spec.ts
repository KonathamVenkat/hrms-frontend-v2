import { REQUISITION_STATUSES, RequisitionStatus } from './models/requisition.model';
import { availableActions, statusBadgeClass } from './requisition-view';

const hr = { isHr: true, isRequester: false };
const hrRequester = { isHr: true, isRequester: true };
const requester = { isHr: false, isRequester: true };
const bystander = { isHr: false, isRequester: false };

describe('availableActions', () => {
  it('lets the requester or HR edit, submit and cancel a draft', () => {
    expect(availableActions('DRAFT', requester)).toEqual(['edit', 'submit', 'cancel']);
    expect(availableActions('DRAFT', hr)).toEqual(['edit', 'submit', 'cancel']);
    expect(availableActions('DRAFT', bystander)).toEqual([]);
  });

  it('lets HR decide on a pending requisition, but never on their own', () => {
    expect(availableActions('PENDING_APPROVAL', hr)).toEqual(['approve', 'reject', 'cancel']);
    expect(availableActions('PENDING_APPROVAL', hrRequester)).toEqual(['cancel']);
  });

  it('lets the requester only cancel a pending requisition', () => {
    expect(availableActions('PENDING_APPROVAL', requester)).toEqual(['cancel']);
    expect(availableActions('PENDING_APPROVAL', bystander)).toEqual([]);
  });

  it('keeps hold, resume and close for HR once approved', () => {
    expect(availableActions('APPROVED', hr)).toEqual(['hold', 'close', 'cancel']);
    expect(availableActions('ON_HOLD', hr)).toEqual(['resume', 'close', 'cancel']);
    expect(availableActions('APPROVED', requester)).toEqual([]);
    expect(availableActions('ON_HOLD', requester)).toEqual([]);
  });

  it('offers nothing on a finished requisition', () => {
    for (const status of ['REJECTED', 'FILLED', 'CLOSED', 'CANCELLED'] as RequisitionStatus[]) {
      expect(availableActions(status, hr)).toEqual([]);
      expect(availableActions(status, requester)).toEqual([]);
    }
  });
});

describe('statusBadgeClass', () => {
  it('gives every status a class, and each meaning its own colour', () => {
    expect(REQUISITION_STATUSES.every((s) => statusBadgeClass(s).startsWith('status-'))).toBe(true);
    expect(statusBadgeClass('APPROVED')).toBe('status-active');
    expect(statusBadgeClass('PENDING_APPROVAL')).toBe('status-pending');
    expect(statusBadgeClass('REJECTED')).toBe('status-rejected');
    expect(statusBadgeClass('DRAFT')).toBe('status-inactive');
  });
});
