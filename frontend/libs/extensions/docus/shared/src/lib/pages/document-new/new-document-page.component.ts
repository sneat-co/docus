import {
  Component,
  computed,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonListHeader,
  IonRow,
  IonText,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { ContactsSelectorInputComponent } from '@sneat/extension-contactus-shared';
import { ClassName, ISelectItem } from '@sneat/ui';
import { CountrySelectorComponent } from '@sneat/components';
import {
  addSpace,
  IContactContext,
  IContactusSpaceDboAndID,
  IContactWithBrief,
  IContactWithBriefAndSpace,
} from '@sneat/extension-contactus-contract';
import { AddAssetBaseComponent } from '@sneat/extension-assetus-shared';
import { AssetusCoreServicesModule } from '@sneat/extension-assetus-internal';
import {
  IDocTypeStandardFields,
  AssetDocumentType,
  standardDocTypesByID,
  IAssetDocumentExtra,
  ICreateAssetRequest,
  IAssetResponse,
} from '@sneat/extension-assetus-contract';
import {
  docTypeListItems,
  getDocTypeSchema,
  groupedDocTypeSchemas,
  IDocContactRef,
  IDocContactRoleDef,
  IDocTypeSchema,
  validateDocContactRoles,
  validateDocFields,
} from '@sneat/extension-docus-contract';
import { SpaceComponentBaseParams } from '@sneat/space-components';
import {
  ContactService,
  ContactusServicesModule,
} from '@sneat/extension-contactus-internal';
import { zipMapBriefsWithIDs } from '@sneat/space-models';
import { SpaceNavService, SpaceServiceModule } from '@sneat/space-services';
import { distinctUntilChanged, map, Subject, takeUntil } from 'rxjs';

@Component({
  imports: [
    FormsModule,
    CountrySelectorComponent,
    SpaceServiceModule,
    AssetusCoreServicesModule,
    ContactusServicesModule,
    ContactsSelectorInputComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonText,
    IonCard,
    IonItem,
    IonLabel,
    IonInput,
    IonItemDivider,
    IonGrid,
    IonRow,
    IonCol,
    IonCheckbox,
    IonCardContent,
    IonButton,
    IonList,
    IonListHeader,
    RouterLink,
  ],
  providers: [
    SpaceComponentBaseParams,
    { provide: ClassName, useValue: 'NewDocumentPageComponent' },
  ],
  selector: 'docus-new-document',
  templateUrl: './new-document-page.component.html',
})
export class NewDocumentPageComponent
  extends AddAssetBaseComponent
  implements OnChanges
{
  private readonly contactService = inject(ContactService);
  private readonly spaceNavService = inject(SpaceNavService);
  private readonly toastCtrl = inject(ToastController);

  // @Input() public override space?: ISpaceContext;
  // contactusSpace and country were inherited from the legacy AddAssetBaseComponent;
  // the new @sneat/extension-assetus base no longer declares them, so they are
  // now owned locally (same fields, same behaviour).
  @Input() public contactusSpace?: IContactusSpaceDboAndID;
  protected country?: string;

  protected contact?: IContactContext;

  protected isMissingRequiredParams = false;

  protected readonly docTypes: ISelectItem[] = [...docTypeListItems];

  // Doc types grouped for a sensibly-sectioned picker (Identity / Family /
  // Vehicle / Education / Legal). Types without a docus schema yet (e.g.
  // 'other') are not part of any group and are offered via the "Other" entry
  // below the groups.
  protected readonly groupedDocTypes = groupedDocTypeSchemas();

  protected docTitle = '';
  // Unset until the user picks a type. The legacy lib modelled "no type chosen"
  // as the 'unspecified' member of AssetDocumentType, which the live
  // @sneat/extension-assetus no longer defines; undefined carries the same
  // "not yet selected" meaning the template guards rely on.
  protected docType?: AssetDocumentType | 'other';
  protected docFields: IDocTypeStandardFields = {};
  protected docNumber = '';

  // --- New doc-type schema state (typed fields + multi-contact roles) ---
  // Populated whenever the picked docType has a docus doc-type schema
  // (marriage_cert, birth_cert, passport, driving_license, id_card, diploma,
  // employment_contract). Types without a schema (e.g. 'other') keep using
  // the legacy fields above so nothing already working regresses.
  protected roleContacts: Record<string, readonly IContactWithBriefAndSpace[]> =
    {};
  protected readonly revealedOptionalRoles = new Set<string>();
  protected fieldValues: Record<string, string> = {};

  private readonly memberChanged = new Subject<void>();

  protected readonly $contacts = signal<
    readonly IContactWithBrief[] | undefined
  >(undefined);

  protected readonly $selectedContacts = signal<
    readonly IContactWithBriefAndSpace[]
  >([]);

  protected readonly $hasSelectedContacts = computed<boolean>(
    () => !!this.$selectedContacts().length,
  );

  public constructor() {
    super();
    this.trackUrl();
  }

  protected get schema(): IDocTypeSchema | undefined {
    return getDocTypeSchema(this.docType);
  }

  onDocTypeChange(docType: AssetDocumentType | 'other'): void {
    this.docFields = standardDocTypesByID[docType]?.fields || {};
    this.roleContacts = {};
    this.revealedOptionalRoles.clear();
    this.fieldValues = {};
  }

  protected selectDocType(id: string): void {
    this.docType = id as AssetDocumentType | 'other';
    this.onDocTypeChange(this.docType);
  }

  protected clearDocType(): void {
    this.docType = undefined;
  }

  protected get selectedDocTypeItem(): ISelectItem | undefined {
    return this.docTypes.find((t) => t.id === this.docType);
  }

  protected get hasRequiredContacts(): boolean {
    return this.contactRoleErrors.length === 0;
  }

  protected isRoleVisible(role: IDocContactRoleDef): boolean {
    return role.min > 0 || this.revealedOptionalRoles.has(role.id);
  }

  protected revealOptionalRole(role: IDocContactRoleDef): void {
    this.revealedOptionalRoles.add(role.id);
  }

  protected roleContactsFor(
    roleId: string,
  ): readonly IContactWithBriefAndSpace[] {
    return this.roleContacts[roleId] ?? [];
  }

  protected onRoleContactsChange(
    roleId: string,
    contacts: readonly IContactWithBriefAndSpace[],
  ): void {
    this.roleContacts = { ...this.roleContacts, [roleId]: contacts };
  }

  private get contactRefs(): IDocContactRef[] {
    return Object.entries(this.roleContacts).flatMap(([role, contacts]) =>
      (contacts || []).map((c) => ({ role, contactID: c.id })),
    );
  }

  protected get contactRoleErrors(): string[] {
    const schema = this.schema;
    return schema ? validateDocContactRoles(schema, this.contactRefs) : [];
  }

  protected get fieldErrors(): string[] {
    const schema = this.schema;
    return schema ? validateDocFields(schema, this.fieldValues) : [];
  }

  private trackUrl(): void {
    this.trackUrlMemberID();
    this.trackUrlDocType();
  }

  protected get isFormValid(): boolean {
    if (!this.docType) {
      return false;
    }
    const schema = this.schema;
    if (schema) {
      return (
        this.contactRoleErrors.length === 0 && this.fieldErrors.length === 0
      );
    }
    const fields = standardDocTypesByID[this.docType]?.fields;
    this.docFields = fields || {};
    if (!fields) {
      return false;
    }
    if (fields?.title?.required && !this.docTitle.trim()) {
      return false;
    }
    if (fields?.number?.required && !this.docNumber.trim()) {
      return false;
    }
    // if (fields.validTill?.required && !this.docNumber.trim()) {
    // 	return false;
    // }
    return true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['contactusTeam']) {
      const space = this.space;
      if (space) {
        const contactusTeam = this.contactusSpace;
        this.$contacts.set(
          zipMapBriefsWithIDs(contactusTeam?.dbo?.contacts).map(
            addSpace(space),
          ),
        );
      }
    }
  }

  private trackUrlMemberID(): void {
    this.route.queryParams
      .pipe(
        takeUntil(this.destroyed$),
        map((qp) => qp['contact'] as string),
        distinctUntilChanged(),
      )
      .subscribe({
        next: this.watchContact,
      });
  }

  private trackUrlDocType(): void {
    this.route.queryParams
      .pipe(
        takeUntil(this.destroyed$),
        map((qp) => qp['type'] as string),
        distinctUntilChanged(),
      )
      .subscribe((docType) => {
        this.docType = docType as AssetDocumentType | 'other';
        if (this.docType) {
          this.onDocTypeChange(this.docType);
        }
      });
  }

  private watchContact = (contactID: string): void => {
    this.memberChanged.next();
    const space = this.space;
    if (!space) {
      return;
    }
    this.contact = { id: contactID, space };
    this.contactService.watchContactById(space, contactID).subscribe({
      next: (member) => {
        this.contact = member;
      },
      error: this.errorLogger.logErrorHandler('failed in watching member'),
    });
  };

  private computeDocumentName(schema: IDocTypeSchema): string {
    const nameByRole = (roleId: string): string | undefined =>
      this.roleContactsFor(roleId)[0]?.brief?.title;
    if (schema.id === 'marriage_cert') {
      const a = nameByRole('spouse1');
      const b = nameByRole('spouse2');
      return a && b ? `${schema.title} — ${a} & ${b}` : schema.title;
    }
    if (schema.id === 'birth_cert') {
      const child = nameByRole('child');
      return child ? `${schema.title} — ${child}` : schema.title;
    }
    const primaryRoleID = schema.contactRoles[0]?.id;
    const primary = primaryRoleID ? nameByRole(primaryRoleID) : undefined;
    return primary ? `${schema.title} — ${primary}` : schema.title;
  }

  protected submit(): void {
    if (!this.space || this.isSubmitting) {
      return;
    }
    const schema = this.schema;
    if (schema) {
      this.submitSchemaBased(schema);
    } else {
      this.submitLegacy();
    }
  }

  private submitLegacy(): void {
    const space = this.space;
    if (!space) {
      return;
    }
    const extra: IAssetDocumentExtra = {
      number: this.docNumber,
    };
    const request: ICreateAssetRequest = {
      spaceID: space.id,
      name: this.docTitle,
      category: 'document',
      condition: 'good',
      status: 'draft',
      possession: 'owning',
      type: this.docType,
      memberIDs: this.contact?.id ? [this.contact.id] : undefined,
      extraType: 'document',
      extra: extra as Record<string, unknown>,
    };
    this.isSubmitting = true;
    this.assetService.createAsset(request).subscribe({
      next: (resp) => {
        this.isSubmitting = false;
        this.onDocCreated(resp);
      },
      error: (err: unknown) => {
        this.isSubmitting = false;
        this.errorLogger.logError(err, 'Failed to create new document');
        this.showToast('Failed to create document. Please try again.');
      },
    });
  }

  private submitSchemaBased(schema: IDocTypeSchema): void {
    const space = this.space;
    if (!space) {
      return;
    }
    const contactErrors = validateDocContactRoles(schema, this.contactRefs);
    const fieldErrors = validateDocFields(schema, this.fieldValues);
    if (contactErrors.length || fieldErrors.length) {
      this.showToast([...contactErrors, ...fieldErrors].join('; '));
      return;
    }

    // Fable: persist as linkage edges (facade4linkage, role-tagged ItemRef)
    // — do not bake a bespoke member/role array into the document DBO. The
    // canonical target for "this document relates these contacts, with
    // these roles" (2 spouses on a marriage cert, child + parent(s) on a
    // birth cert) is a role-tagged linkage edge per contact, created via
    // `facade4linkage.SetRelated`; see `toLinkageEdgeDrafts()` in
    // `@sneat/extension-docus-contract` for the 1:1 shape those edges would
    // take once a linkage client is wired into this app (documents would
    // then feed the relationship graph on create). There is no such client
    // here today, so only the flat, already-assetus-modelled
    // `memberIDs`/`membersInfo` below are written to the document; the role
    // tags captured in `this.contactRefs` are used for validation/display
    // in this form and then intentionally not persisted.
    const extra: IAssetDocumentExtra = {};
    const fieldsStr: Record<string, string> = {};
    const fieldsDate: Record<string, string> = {};
    for (const f of schema.fields) {
      const value = this.fieldValues[f.id]?.trim();
      if (!value) {
        continue;
      }
      if (f.id === 'number') {
        extra.number = value;
      } else if (f.id === 'issuedOn') {
        extra.issuedOn = value;
      } else if (f.id === 'expiresOn') {
        extra.expiresOn = value;
      } else if (f.type === 'date') {
        fieldsDate[f.id] = value;
      } else {
        fieldsStr[f.id] = value;
      }
    }

    const memberIDs = [...new Set(this.contactRefs.map((r) => r.contactID))];
    const membersInfo = memberIDs.map((id) => {
      const contact = Object.values(this.roleContacts)
        .flat()
        .find((c) => c.id === id);
      return { id, title: contact?.brief?.title };
    });

    const request: ICreateAssetRequest = {
      spaceID: space.id,
      name: this.computeDocumentName(schema),
      category: 'document',
      condition: 'good',
      status: 'draft',
      possession: 'owning',
      type: schema.id,
      memberIDs: memberIDs.length ? memberIDs : undefined,
      membersInfo: membersInfo.length ? membersInfo : undefined,
      extraType: 'document',
      extra: extra as Record<string, unknown>,
      fieldsStr: Object.keys(fieldsStr).length ? fieldsStr : undefined,
      fieldsDate: Object.keys(fieldsDate).length ? fieldsDate : undefined,
    };

    this.isSubmitting = true;
    this.assetService.createAsset(request).subscribe({
      next: (resp) => {
        this.isSubmitting = false;
        this.onDocCreated(resp);
      },
      error: (err: unknown) => {
        this.isSubmitting = false;
        this.errorLogger.logError(err, 'Failed to create new document');
        this.showToast('Failed to create document. Please try again.');
      },
    });
  }

  private showToast(message: string): void {
    this.toastCtrl
      .create({ message, duration: 4000, color: 'danger' })
      .then((toast) => toast.present())
      .catch((e: unknown) => this.errorLogger.logError(e));
  }

  private onDocCreated = (resp: IAssetResponse): void => {
    const space = this.space;
    if (!space) {
      return;
    }
    this.spaceNavService
      .navigateForwardToSpacePage(space, 'document/' + resp.id, {
        replaceUrl: true,
      })
      .catch(
        this.errorLogger.logErrorHandler('Failed to navigate to document page'),
      );
  };
}
