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

  it('has no duplicate ids after merging in the docus-only doc types', () => {
    const ids = docTypeListItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the docus-only additions not yet in the assetus registry', () => {
    const ids = docTypeListItems.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining(['id_card', 'diploma', 'employment_contract']),
    );
  });

  it('still includes the pre-existing assetus-backed doc types', () => {
    const ids = docTypeListItems.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'other',
        'passport',
        'driving_license',
        'birth_cert',
        'marriage_cert',
      ]),
    );
  });
});
