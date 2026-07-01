import {
  docTypeSchemas,
  getDocTypeSchema,
  groupedDocTypeSchemas,
  toLinkageEdgeDrafts,
  validateDocContactRoles,
  validateDocFields,
} from './doc-contact-roles';

describe('docTypeSchemas', () => {
  it('models marriage_cert as exactly 2 contacts (spouse1 + spouse2)', () => {
    const schema = docTypeSchemas['marriage_cert'];
    expect(schema.contactRoles).toHaveLength(2);
    const totalMin = schema.contactRoles.reduce((sum, r) => sum + r.min, 0);
    const totalMax = schema.contactRoles.reduce((sum, r) => sum + r.max, 0);
    expect(totalMin).toBe(2);
    expect(totalMax).toBe(2);
  });

  it('models birth_cert as 2-3 contacts (child + 1-2 parents)', () => {
    const schema = docTypeSchemas['birth_cert'];
    const totalMin = schema.contactRoles.reduce((sum, r) => sum + r.min, 0);
    const totalMax = schema.contactRoles.reduce((sum, r) => sum + r.max, 0);
    expect(totalMin).toBe(2);
    expect(totalMax).toBe(3);
  });

  it('every schema has at least one contact role and one field', () => {
    for (const schema of Object.values(docTypeSchemas)) {
      expect(schema.contactRoles.length).toBeGreaterThan(0);
      expect(schema.fields.length).toBeGreaterThan(0);
    }
  });
});

describe('getDocTypeSchema', () => {
  it('returns the schema for a known id', () => {
    expect(getDocTypeSchema('passport')?.id).toBe('passport');
  });

  it('returns undefined for an unknown id', () => {
    expect(getDocTypeSchema('not_a_real_type')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(getDocTypeSchema(undefined)).toBeUndefined();
  });
});

describe('groupedDocTypeSchemas', () => {
  it('groups every schema under a non-empty category', () => {
    const groups = groupedDocTypeSchemas();
    const total = groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(total).toBe(Object.keys(docTypeSchemas).length);
    for (const g of groups) {
      expect(g.items.length).toBeGreaterThan(0);
    }
  });
});

describe('validateDocContactRoles', () => {
  it('requires both spouses for marriage_cert', () => {
    const schema = docTypeSchemas['marriage_cert'];
    expect(validateDocContactRoles(schema, [])).toHaveLength(2);
    expect(
      validateDocContactRoles(schema, [{ role: 'spouse1', contactID: 'a' }]),
    ).toHaveLength(1);
    expect(
      validateDocContactRoles(schema, [
        { role: 'spouse1', contactID: 'a' },
        { role: 'spouse2', contactID: 'b' },
      ]),
    ).toHaveLength(0);
  });

  it('rejects a third spouse (max=1 per role)', () => {
    const schema = docTypeSchemas['marriage_cert'];
    const errors = validateDocContactRoles(schema, [
      { role: 'spouse1', contactID: 'a' },
      { role: 'spouse1', contactID: 'b' },
      { role: 'spouse2', contactID: 'c' },
    ]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts birth_cert with child + 1 parent (parent2 optional)', () => {
    const schema = docTypeSchemas['birth_cert'];
    const errors = validateDocContactRoles(schema, [
      { role: 'child', contactID: 'kid' },
      { role: 'parent1', contactID: 'mom' },
    ]);
    expect(errors).toHaveLength(0);
  });

  it('accepts birth_cert with child + 2 parents', () => {
    const schema = docTypeSchemas['birth_cert'];
    const errors = validateDocContactRoles(schema, [
      { role: 'child', contactID: 'kid' },
      { role: 'parent1', contactID: 'mom' },
      { role: 'parent2', contactID: 'dad' },
    ]);
    expect(errors).toHaveLength(0);
  });

  it('rejects birth_cert missing the child', () => {
    const schema = docTypeSchemas['birth_cert'];
    const errors = validateDocContactRoles(schema, [
      { role: 'parent1', contactID: 'mom' },
    ]);
    expect(errors.some((e) => e.includes('Child'))).toBe(true);
  });
});

describe('validateDocFields', () => {
  it('flags missing required fields', () => {
    const schema = docTypeSchemas['passport'];
    const errors = validateDocFields(schema, {});
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes when all required fields are filled', () => {
    const schema = docTypeSchemas['passport'];
    const errors = validateDocFields(schema, {
      number: 'P123',
      issuedOn: '2020-01-01',
      expiresOn: '2030-01-01',
    });
    expect(errors).toHaveLength(0);
  });
});

describe('toLinkageEdgeDrafts', () => {
  it('maps each contact-role selection to one role-tagged edge', () => {
    const drafts = toLinkageEdgeDrafts('space1', 'doc1', [
      { role: 'spouse1', contactID: 'alice' },
      { role: 'spouse2', contactID: 'bob' },
    ]);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toEqual({
      role: 'spouse1',
      from: { extID: 'docus', collection: 'documents@space1', itemID: 'doc1' },
      to: { extID: 'contactus', collection: 'contacts@space1', itemID: 'alice' },
    });
    expect(drafts[1].to.itemID).toBe('bob');
  });

  it('produces the same document ItemRef for every edge', () => {
    const drafts = toLinkageEdgeDrafts('space1', 'doc1', [
      { role: 'child', contactID: 'kid' },
      { role: 'parent1', contactID: 'mom' },
      { role: 'parent2', contactID: 'dad' },
    ]);
    expect(new Set(drafts.map((d) => JSON.stringify(d.from))).size).toBe(1);
  });

  it('returns an empty array for no selections', () => {
    expect(toLinkageEdgeDrafts('space1', 'doc1', [])).toEqual([]);
  });
});
