import { docusRoutes } from './docus-routing';

describe('docusRoutes', () => {
  it('exposes the documents route', () => {
    expect(docusRoutes.some((r) => r.path === 'documents')).toBe(true);
  });

  it('exposes the new-document route', () => {
    expect(docusRoutes.some((r) => r.path === 'new-document')).toBe(true);
  });

  it('exposes the document details route (closes the pre-existing goDoc/onDocCreated dead end)', () => {
    expect(docusRoutes.some((r) => r.path === 'document/:id')).toBe(true);
  });

  it('lazy-loads every route via loadComponent', () => {
    for (const route of docusRoutes) {
      expect(typeof route.loadComponent).toBe('function');
    }
  });
});
