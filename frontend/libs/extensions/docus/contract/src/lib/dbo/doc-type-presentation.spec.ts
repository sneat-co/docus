import { docTypeListItems } from './doc-type-presentation';

describe('docTypeListItems', () => {
  it('is non-empty', () => {
    expect(docTypeListItems.length).toBeGreaterThan(0);
  });

  it('every item has an id and a title', () => {
    for (const item of docTypeListItems) {
      expect(typeof item.id).toBe('string');
      expect(item.id).toBeTruthy();
      expect(typeof item.title).toBe('string');
      expect(item.title).toBeTruthy();
    }
  });
});
