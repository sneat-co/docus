import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
} from '@ionic/angular/standalone';
import { IAssetDocumentContext } from '@sneat/extension-assetus-contract';
import { DocumentsBaseComponent } from '../documents-base.component';

@Component({
  selector: 'docus-documents-list',
  templateUrl: './documents-list.component.html',
  ...DocumentsBaseComponent.metadata,
  imports: [
    IonItemSliding,
    IonItem,
    IonLabel,
    IonItemOptions,
    IonItemOption,
    IonIcon,
    IonList,
    IonButton,
    IonButtons,
    RouterLink,
  ],
})
export class DocumentsListComponent
  extends DocumentsBaseComponent
  implements OnChanges
{
  @Input() public filter = '';
  @Output() public readonly goDoc = new EventEmitter<IAssetDocumentContext>();

  protected filteredDocs?: IAssetDocumentContext[];

  public constructor() {
    super();
  }

  protected readonly trackById = (i: number, record: { id: string }) =>
    record.id;

  ngOnChanges(changes: SimpleChanges): void {
    // console.log('DocumentsListComponent.ngOnChanges', changes, [...this.allDocuments], ''+this.filter);
    if (changes['allDocuments'] || changes['filter']) {
      this.onDocsChanged();
    }
  }

  protected onDocsChanged(): void {
    const text: string = this.filter;
    // Preserve the undefined/loading vs. empty-array/loaded distinction so
    // the template can tell "still loading" apart from "loaded, zero
    // documents" (the latter renders the mandatory empty state).
    this.filteredDocs =
      this.allDocuments === undefined
        ? undefined
        : this.allDocuments.filter(
            (d) =>
              !text ||
              (d.dbo?.name && d.dbo.name.toLowerCase().includes(text)) ||
              (d.dbo?.type && d.dbo.type.toLowerCase().includes(text)),
          );
  }
}
