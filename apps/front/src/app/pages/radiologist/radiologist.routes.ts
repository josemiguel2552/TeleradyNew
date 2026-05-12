import { Routes } from '@angular/router';
import { radiologistGuard } from './guards/radiologist.guard';

export const RADIOLOGIST_ROUTES: Routes = [
  {
    path: '',
    canActivate: [radiologistGuard],
    children: [
      {
        path: 'worklist',
        loadComponent: () =>
          import('./worklist/worklist.component').then((m) => m.WorklistComponent),
      },
      {
        path: 'study/:id',
        loadComponent: () =>
          import('./study-viewer/study-viewer.component').then((m) => m.StudyViewerComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'worklist' },
    ],
  },
];
