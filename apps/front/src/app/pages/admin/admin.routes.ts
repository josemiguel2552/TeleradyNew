import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    children: [
      {
        path: 'sla',
        loadComponent: () => import('./sla/sla.component').then((m) => m.AdminSlaComponent),
      },
      {
        path: 'assignments',
        loadComponent: () =>
          import('./assignments/assignments.component').then((m) => m.AdminAssignmentsComponent),
      },
      {
        path: 'me',
        loadComponent: () => import('./me/admin-me.component').then((m) => m.AdminMeComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'sla' },
    ],
  },
];
