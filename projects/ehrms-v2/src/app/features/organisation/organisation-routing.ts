import { Routes } from '@angular/router';

/** HR-only: the parent route in app.routes.ts is guarded with HR_ROLES, matching the API (HR_ADMIN, HR_MANAGER). */
export const ORGANISATION_ROUTES: Routes = [
  {
    path: 'branches',
    loadComponent: () => import('./pages/branch-setup/branch-setup').then((m) => m.BranchSetup),
    title: 'organisation.routes.branchSetup',
  },
  {
    path: 'branch-assignments',
    loadComponent: () =>
      import('./pages/branch-assignments/branch-assignments').then((m) => m.BranchAssignments),
    title: 'organisation.routes.branchAssignments',
  },
  { path: '', redirectTo: 'branches', pathMatch: 'full' },
];
