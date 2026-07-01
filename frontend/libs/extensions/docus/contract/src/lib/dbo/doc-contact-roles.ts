// Docus product-surface extension of the shared assetus document model.
//
// The canonical document data model (asset core + `document` extra + the
// per-doc-type field schema `IDocTypeStandardFields` / `standardDocTypesByID`
// + multi-contact refs via `memberIDs`/`membersInfo`) lives in
// `@sneat/extension-assetus-contract` (see the `unified-assetus-data-model`
// spec — "marriage certificate allows two members"). Docus does not fork
// that model; it narrows/presents it (same relationship as AnyMeter over
// trackus).
//
// What's missing from the *live* assetus registry for the document types this
// module adds is (a) per-role tagging of multiple contacts (today it is a
// single flat `members.max` count, no way to say "spouse 1" vs "spouse 2" or
// "child" vs "parent"), and (b) named typed fields beyond the fixed
// `title/number/issuedBy/issuedOn/validTill` slots (nationality, categories,
// institution, ...). Both are modelled here, locally, as a strict superset
// that stays representable inside the existing assetus DBO shape:
//   - extra named fields are written into the assetus-provided generic
//     `fieldsStr`/`fieldsDate`/`fieldsInt` bags (`IAssetRichFields`), not a
//     new bespoke store.
//   - the *contact-role selections themselves* (spouse 1/2, child, parent
//     1/2, holder, ...) are NOT persisted as a bespoke member/role array on
//     the document. The canonical target for "this document relates these
//     contacts, with these roles" is the shared **linkage** system
//     (`sneat-core-modules/linkage/dbo4linkage` + `facade4linkage`):
//     every linkable item is an `ItemRef{ExtID, Collection, ItemID}`, and
//     role-tagged, bidirectional relationships between two ItemRefs are
//     created/updated via `facade4linkage.SetRelated` /
//     `update_item_relationships`. A document relating 2 spouses, or a
//     child + parent(s), is exactly that: role-tagged edges from the
//     document's ItemRef to each contact's ItemRef. This file only models
//     the *shape* those edges would take (`IDocLinkageEdgeDraft`,
//     `toLinkageEdgeDrafts`) and keeps it covered by tests — it does not
//     call any facade (this frontend has no linkage client wired in yet)
//     and does not persist the role tags anywhere. Only the flat,
//     already-assetus-modelled `memberIDs`/`membersInfo` are written to the
//     document today (see new-document-page.component.ts).
//
// Fable: persist as linkage edges (facade4linkage, role-tagged ItemRef) —
// do not bake a bespoke member/role array into the document DBO. Once a
// linkage client is reachable from this app, `toLinkageEdgeDrafts()`'s
// output feeds one `SetRelated` call per edge (documents feed the graph:
// a marriage cert creates a spouse<->spouse edge, a birth cert creates
// parent<->child edges).
//
// Fable: fold into assetus IDocTypeDef (canonical registry) — once assetus's
// IDocTypeDef supports per-role contact slots and named extra fields, this
// file's `docTypeSchemas` should be deleted and its data merged upstream;
// docus would go back to being a pure presentation layer, matching the
// existing TODO in `doc-type-presentation.ts`.

/** Sensible groupings for the new-document type picker. */
export type DocTypeCategory =
  | 'identity'
  | 'family'
  | 'vehicle'
  | 'education'
  | 'legal';

export const docTypeCategoryLabels: Record<DocTypeCategory, string> = {
  identity: 'Identity',
  family: 'Family',
  vehicle: 'Vehicle',
  education: 'Education',
  legal: 'Legal',
};

/** A named contact slot a document type requires/allows (e.g. "spouse 1"). */
export interface IDocContactRoleDef {
  readonly id: string;
  readonly label: string;
  /** Minimum number of contacts that must fill this role. */
  readonly min: number;
  /** Maximum number of contacts that may fill this role. */
  readonly max: number;
}

export type DocFieldType = 'text' | 'date' | 'number';

/** A typed field beyond the standard assetus title/number/issuedOn/validTill. */
export interface IDocFieldDef {
  readonly id: string;
  readonly label: string;
  readonly type: DocFieldType;
  readonly required?: boolean;
}

export interface IDocTypeSchema {
  readonly id: string;
  readonly title: string;
  readonly emoji?: string;
  readonly category: DocTypeCategory;
  readonly contactRoles: readonly IDocContactRoleDef[];
  readonly fields: readonly IDocFieldDef[];
}

/** A single contact reference tagged with the role it fills on a document. */
export interface IDocContactRef {
  readonly role: string;
  readonly contactID: string;
}

// --- Linkage-edge shape (not persisted here — see the header comment) ---
//
// Mirrors `sneat-core-modules/linkage/dbo4linkage.ItemRef`: every linkable
// item (document, asset, contact, contract, ...) is identified by
// {ExtID, Collection, ItemID}.
export interface IDocLinkageItemRef {
  readonly extID: string;
  readonly collection: string;
  readonly itemID: string;
}

/**
 * One role-tagged linkage edge a document implies once it can be persisted
 * through `facade4linkage` (`SetRelated`/`update_item_relationships`).
 *
 * Fable: persist as linkage edges (facade4linkage, role-tagged ItemRef) — do
 * not bake a bespoke member/role array. This type + `toLinkageEdgeDrafts`
 * exist so the mapping from "contact-role selections in the new-document
 * form" to "linkage edges" is defined and tested, ready for the day a
 * linkage client is wired into this app; nothing here is written to the
 * document DBO.
 */
export interface IDocLinkageEdgeDraft {
  readonly role: string;
  readonly from: IDocLinkageItemRef;
  readonly to: IDocLinkageItemRef;
}

export function contactItemRef(
  spaceID: string,
  contactID: string,
): IDocLinkageItemRef {
  return {
    extID: 'contactus',
    collection: `contacts@${spaceID}`,
    itemID: contactID,
  };
}

export function documentItemRef(
  spaceID: string,
  documentID: string,
): IDocLinkageItemRef {
  return {
    extID: 'docus',
    collection: `documents@${spaceID}`,
    itemID: documentID,
  };
}

/**
 * Maps a document's contact-role selections 1:1 onto the linkage edges a
 * real `facade4linkage.SetRelated` call would create: one role-tagged edge
 * per selected contact, from the document's ItemRef to the contact's
 * ItemRef. Pure mapping only — does not call any facade.
 */
export function toLinkageEdgeDrafts(
  spaceID: string,
  documentID: string,
  refs: readonly IDocContactRef[],
): IDocLinkageEdgeDraft[] {
  const from = documentItemRef(spaceID, documentID);
  return refs.map((r) => ({
    role: r.role,
    from,
    to: contactItemRef(spaceID, r.contactID),
  }));
}

// The flagship examples (marriage = exactly 2 contacts, birth = 2-3 contacts)
// plus a handful of everyday identity/education/legal document types.
export const docTypeSchemas: Record<string, IDocTypeSchema> = {
  marriage_cert: {
    id: 'marriage_cert',
    title: 'Marriage certificate',
    emoji: '💍',
    category: 'family',
    contactRoles: [
      { id: 'spouse1', label: 'Spouse', min: 1, max: 1 },
      { id: 'spouse2', label: 'Spouse', min: 1, max: 1 },
    ],
    fields: [
      { id: 'date', label: 'Date of marriage', type: 'date', required: true },
      { id: 'place', label: 'Place', type: 'text' },
      {
        id: 'number',
        label: 'Certificate number',
        type: 'text',
        required: true,
      },
    ],
  },
  birth_cert: {
    id: 'birth_cert',
    title: 'Birth certificate',
    emoji: '👼',
    category: 'family',
    contactRoles: [
      { id: 'child', label: 'Child', min: 1, max: 1 },
      { id: 'parent1', label: 'Parent', min: 1, max: 1 },
      { id: 'parent2', label: 'Parent', min: 0, max: 1 },
    ],
    fields: [
      {
        id: 'dateOfBirth',
        label: 'Date of birth',
        type: 'date',
        required: true,
      },
      { id: 'place', label: 'Place of birth', type: 'text' },
      {
        id: 'number',
        label: 'Registration number',
        type: 'text',
        required: true,
      },
    ],
  },
  passport: {
    id: 'passport',
    title: 'Passport',
    emoji: '🛂',
    category: 'identity',
    contactRoles: [{ id: 'holder', label: 'Holder', min: 1, max: 1 }],
    fields: [
      { id: 'number', label: 'Passport number', type: 'text', required: true },
      { id: 'nationality', label: 'Nationality', type: 'text' },
      { id: 'issuedOn', label: 'Issue date', type: 'date', required: true },
      { id: 'expiresOn', label: 'Expiry date', type: 'date', required: true },
    ],
  },
  driving_license: {
    id: 'driving_license',
    title: 'Driving licence',
    emoji: '🚗',
    category: 'identity',
    contactRoles: [{ id: 'holder', label: 'Holder', min: 1, max: 1 }],
    fields: [
      { id: 'number', label: 'Licence number', type: 'text', required: true },
      { id: 'categories', label: 'Categories', type: 'text' },
      { id: 'issuedOn', label: 'Issue date', type: 'date', required: true },
      { id: 'expiresOn', label: 'Expiry date', type: 'date' },
    ],
  },
  // Fable: fold into assetus IDocTypeDef (canonical registry) — `id_card` is
  // not yet present in the live `standardDocTypesByID`.
  id_card: {
    id: 'id_card',
    title: 'National ID card',
    emoji: '🪪',
    category: 'identity',
    contactRoles: [{ id: 'holder', label: 'Holder', min: 1, max: 1 }],
    fields: [
      { id: 'number', label: 'ID number', type: 'text', required: true },
      { id: 'issuedOn', label: 'Issue date', type: 'date' },
      { id: 'expiresOn', label: 'Expiry date', type: 'date' },
    ],
  },
  // Fable: fold into assetus IDocTypeDef (canonical registry) — new type.
  diploma: {
    id: 'diploma',
    title: 'Diploma / certificate',
    emoji: '🎓',
    category: 'education',
    contactRoles: [{ id: 'recipient', label: 'Recipient', min: 1, max: 1 }],
    fields: [
      { id: 'institution', label: 'Institution', type: 'text', required: true },
      { id: 'title', label: 'Title / degree', type: 'text', required: true },
      { id: 'date', label: 'Date', type: 'date', required: true },
    ],
  },
  // Fable: fold into assetus IDocTypeDef (canonical registry) — new type.
  employment_contract: {
    id: 'employment_contract',
    title: 'Employment contract',
    emoji: '🧑‍💼',
    category: 'legal',
    contactRoles: [
      { id: 'employee', label: 'Employee', min: 1, max: 1 },
      { id: 'employer', label: 'Employer', min: 1, max: 1 },
    ],
    fields: [
      { id: 'startDate', label: 'Start date', type: 'date', required: true },
      { id: 'role', label: 'Role / position', type: 'text', required: true },
    ],
  },
};

export function getDocTypeSchema(
  id: string | undefined,
): IDocTypeSchema | undefined {
  return id ? docTypeSchemas[id] : undefined;
}

/** Doc-type schemas grouped for a sensibly-sectioned type picker. */
export function groupedDocTypeSchemas(): readonly {
  category: DocTypeCategory;
  label: string;
  items: readonly IDocTypeSchema[];
}[] {
  const categories = Object.keys(docTypeCategoryLabels) as DocTypeCategory[];
  return categories
    .map((category) => ({
      category,
      label: docTypeCategoryLabels[category],
      items: Object.values(docTypeSchemas).filter(
        (s) => s.category === category,
      ),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Validates the min/max contact-count rules for every role of a schema.
 * Returns a human-readable error per violated role; empty array = valid.
 */
export function validateDocContactRoles(
  schema: IDocTypeSchema,
  refs: readonly IDocContactRef[],
): string[] {
  const errors: string[] = [];
  for (const role of schema.contactRoles) {
    const count = refs.filter((r) => r.role === role.id).length;
    if (count < role.min) {
      errors.push(
        role.min === role.max && role.max === 1
          ? `${role.label} is required`
          : `${role.label}: at least ${role.min} required`,
      );
    } else if (count > role.max) {
      errors.push(`${role.label}: choose at most ${role.max}`);
    }
  }
  return errors;
}

/** Validates the required typed fields of a schema. Empty array = valid. */
export function validateDocFields(
  schema: IDocTypeSchema,
  values: Readonly<Record<string, string | undefined>>,
): string[] {
  const errors: string[] = [];
  for (const f of schema.fields) {
    if (f.required && !values[f.id]?.trim()) {
      errors.push(`${f.label} is required`);
    }
  }
  return errors;
}
