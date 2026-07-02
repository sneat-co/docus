import { Component, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { IAssetDocumentContext } from '@sneat/extension-assetus-contract';
import { docTypeListItems } from '@sneat/extension-docus-contract';
import {
  AssetService,
  AssetusCoreServicesModule,
} from '@sneat/extension-assetus-internal';
import {
  ContactService,
  ContactusServicesModule,
} from '@sneat/extension-contactus-internal';
import {
  SpaceComponentBaseParams,
  SpaceItemsBaseComponent,
} from '@sneat/space-components';
import { SpaceServiceModule } from '@sneat/space-services';
import { ClassName } from '@sneat/ui';
import { distinctUntilChanged, map, takeUntil } from 'rxjs';

// Fills the gap left by the previous docus flows, which already navigated
// here (`document/${id}`) from both the documents list (`goDoc`) and after
// creating a new document, even though this route/page didn't exist yet —
// a dead end per the screen-flow checklist. This page closes that gap.
@Component({
  selector: 'docus-document-details',
  templateUrl: './document-details-page.component.html',
  imports: [
    AssetusCoreServicesModule,
    ContactusServicesModule,
    SpaceServiceModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonText,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonList,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonButton,
  ],
  providers: [
    SpaceComponentBaseParams,
    { provide: ClassName, useValue: 'DocumentDetailsPageComponent' },
  ],
})
export class DocumentDetailsPageComponent extends SpaceItemsBaseComponent {
  private readonly assetService = inject(AssetService);
  private readonly contactService = inject(ContactService);
  private readonly toastCtrl = inject(ToastController);

  protected documentID?: string;
  protected document?: IAssetDocumentContext;

  // Tri-state per the house states standard: loading / error / content must
  // be distinct — a load failure must not masquerade as "Loading…" forever
  // (or as empty). Error card with Retry follows the budgetus precedent.
  protected readonly $error = signal<string | undefined>(undefined);

  protected readonly $contactTitles = signal<Readonly<Record<string, string>>>(
    {},
  );

  public constructor() {
    super('documents');
    this.trackDocumentID();
  }

  protected override onSpaceIdChanged(): void {
    super.onSpaceIdChanged();
    this.loadDocument();
  }

  protected get docTypeItem() {
    return docTypeListItems.find((i) => i.id === this.document?.dbo?.type);
  }

  protected get memberIDs(): readonly string[] {
    return this.document?.dbo?.memberIDs ?? [];
  }

  // Fable: linkage-graph follow-up — once documents persist role-tagged
  // linkage edges (see `toLinkageEdgeDrafts` in
  // `@sneat/extension-docus-contract`), this list should be replaced by the
  // edges for this document's ItemRef, rendering each person WITH their
  // role (Spouse / Child / Parent / Holder / ...) instead of the flat,
  // role-less `memberIDs` used below.
  private trackDocumentID(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroyed$),
        map((pm) => pm.get('id') ?? undefined),
        distinctUntilChanged(),
      )
      .subscribe((id) => {
        this.documentID = id;
        this.loadDocument();
      });
  }

  private loadDocument(): void {
    const space = this.space;
    const id = this.documentID;
    if (!space?.id || !id) {
      return;
    }
    this.$error.set(undefined);
    this.assetService
      .watchAssetByID(space, id)
      .pipe(this.takeUntilDestroyed())
      .subscribe({
        next: (doc) => {
          this.document = doc as IAssetDocumentContext;
          this.loadContactNames();
        },
        error: (err: unknown) => {
          // Fable refactoring: this was log-only
          // (`this.errorLogger.logErrorHandler('Failed to load document')`),
          // leaving the page stuck on "Loading…" forever for a failed load or
          // nonexistent id. Surface the error state instead (tri-state).
          this.errorLogger.logError(err, 'Failed to load document');
          this.$error.set(
            'Failed to load this document. It may have been deleted, or you may not have access.',
          );
        },
      });
  }

  /** Retry after a failed load (budgetus error-card precedent). */
  protected reload(): void {
    this.loadDocument();
  }

  private loadContactNames(): void {
    const space = this.space;
    const ids = this.memberIDs;
    if (!space?.id || !ids.length) {
      return;
    }
    for (const id of ids) {
      this.contactService
        .watchContactById(space, id)
        .pipe(this.takeUntilDestroyed())
        .subscribe({
          next: (c) => {
            const title = c.brief?.title || c.dbo?.title || id;
            this.$contactTitles.update((m) => ({ ...m, [id]: title }));
          },
        });
    }
  }

  protected remove(): void {
    const space = this.space;
    const id = this.documentID;
    if (!space?.id || !id) {
      return;
    }
    if (!confirm('Delete this document? This cannot be undone.')) {
      return;
    }
    this.assetService
      .removeAsset({ spaceID: space.id, assetID: id })
      .subscribe({
        next: () => {
          this.spaceNav
            .navigateBackToSpacePage(space, 'documents')
            .catch(this.errorLogger.logErrorHandler('Failed to navigate back'));
        },
        error: (err: unknown) => {
          this.errorLogger.logError(err, 'Failed to delete document');
          this.toastCtrl
            .create({
              message: 'Failed to delete document. Please try again.',
              duration: 4000,
              color: 'danger',
            })
            .then((toast) => toast.present())
            .catch((e: unknown) => this.errorLogger.logError(e));
        },
      });
  }
}
