import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

/**
 * Branch manager, department secretary and department head are relationships, not login roles, so any
 * signed-in staff role may open the inbox; the API decides what it holds and who may act. SYSTEM_ADMIN
 * has no requests, so is kept out.
 */
const WORKFLOW_ROLES = ['HR_ADMIN', 'HR_MANAGER', 'GENERAL_MANAGER', 'EMPLOYEE'];

export const WORKFLOW_ROUTES: Routes = [
  {
    path: 'inbox',
    canActivate: [roleGuard(...WORKFLOW_ROLES)],
    loadComponent: () =>
      import('./pages/approvals-inbox/approvals-inbox').then((m) => m.ApprovalsInbox),
    title: 'workflow.routes.inbox',
  },
  {
    path: 'requests/:type/:id',
    canActivate: [roleGuard(...WORKFLOW_ROLES)],
    loadComponent: () =>
      import('./pages/request-detail/request-detail').then((m) => m.RequestDetail),
    title: 'workflow.routes.detail',
  },
  { path: '', redirectTo: 'inbox', pathMatch: 'full' },
];
