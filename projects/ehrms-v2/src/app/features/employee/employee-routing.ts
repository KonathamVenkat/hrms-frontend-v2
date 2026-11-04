// src/app/features/employee/employee-routing.ts
// ── Add 'detail/:id' route ────────────────────────────────────

import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const EMPLOYEE_ROUTES: Routes = [
  {
    path: 'list',
    loadComponent: () => import('./pages/employee-list/employee-list').then((m) => m.EmployeeList),
    title: 'employee.routes.list',
  },
  {
    path: 'create',
    loadComponent: () => import('./pages/employee-form/employee-form').then((m) => m.EmployeeForm),
    // Typed-in edits that were not saved are asked about before leaving.
    canDeactivate: [unsavedChangesGuard],
    title: 'employee.routes.create',
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./pages/employee-form/employee-form').then((m) => m.EmployeeForm),
    // Typed-in edits that were not saved are asked about before leaving.
    canDeactivate: [unsavedChangesGuard],
    title: 'employee.routes.edit',
  },
  {
    path: 'detail/:id', // ← ADD THIS
    loadComponent: () =>
      import('./pages/employee-detail/employee-detail').then((m) => m.EmployeeDetail),
    // A form open on one of the tabs may hold edits that were not saved.
    canDeactivate: [unsavedChangesGuard],
    title: 'employee.routes.detail',
  },
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full',
  },
];
