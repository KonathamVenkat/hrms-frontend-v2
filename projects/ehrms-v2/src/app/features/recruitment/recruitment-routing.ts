import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

/**
 * Requisitions are for HR and for employees who head a department (the API narrows it per record);
 * SYSTEM_ADMIN has no access to them. The stage and rejection-reason set-up is SYSTEM_ADMIN only.
 * These guards only keep people out of screens whose API calls would answer 403.
 */
const REQUISITION_ROLES = ['HR_ADMIN', 'HR_MANAGER', 'EMPLOYEE'];

export const RECRUITMENT_ROUTES: Routes = [
  {
    path: 'requisitions',
    canActivate: [roleGuard(...REQUISITION_ROLES)],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/requisition-list/requisition-list').then((m) => m.RequisitionList),
        title: 'recruitment.routes.requisitions',
      },
      {
        path: 'new',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./pages/requisition-form/requisition-form').then((m) => m.RequisitionForm),
        title: 'recruitment.routes.new',
      },
      {
        path: ':id/edit',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./pages/requisition-form/requisition-form').then((m) => m.RequisitionForm),
        title: 'recruitment.routes.edit',
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/requisition-detail/requisition-detail').then((m) => m.RequisitionDetail),
        title: 'recruitment.routes.detail',
      },
    ],
  },
  {
    path: 'stages',
    canActivate: [roleGuard('SYSTEM_ADMIN')],
    loadComponent: () => import('./pages/stages/stages').then((m) => m.RecruitmentStages),
    title: 'recruitment.routes.stages',
  },
  {
    path: 'rejection-reasons',
    canActivate: [roleGuard('SYSTEM_ADMIN')],
    loadComponent: () =>
      import('./pages/rejection-reasons/rejection-reasons').then((m) => m.RejectionReasons),
    title: 'recruitment.routes.rejectionReasons',
  },
  { path: '', redirectTo: 'requisitions', pathMatch: 'full' },
];
