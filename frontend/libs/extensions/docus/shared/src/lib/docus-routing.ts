import { Route } from '@angular/router';
// import {guardRoute} from '../../utils/guard-route';

export const docusRoutes: Route[] = [
  {
    path: 'documents',
    data: { title: 'Documents' },
    loadComponent: () =>
      import('./pages/documents/documents-page.component').then(
        (m) => m.DocumentsPageComponent,
      ),
    // ...guardRoute,
  },
  {
    path: 'document/:id',
    data: { title: 'Document' },
    loadComponent: () =>
      import('./pages/document-details/document-details-page.component').then(
        (m) => m.DocumentDetailsPageComponent,
      ),
    // ...guardRoute,
  },
  {
    path: 'new-document',
    data: { title: 'New Document' },
    loadComponent: () =>
      import('./pages/document-new/new-document-page.component').then(
        (m) => m.NewDocumentPageComponent,
      ),
    // ...guardRoute,
  },
];
