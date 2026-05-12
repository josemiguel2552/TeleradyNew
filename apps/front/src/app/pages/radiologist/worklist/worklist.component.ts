import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { catchError, of } from 'rxjs';
import {
  WorklistEntry,
  WorklistFilters,
  WorklistService,
} from '../services/worklist.service';

interface StateOption {
  label: string;
  value: number | null;
}

const STATE_OPTIONS: StateOption[] = [
  { label: 'All', value: null },
  { label: 'Pending', value: 1 },
  { label: 'In review', value: 2 },
  { label: 'Completed', value: 3 },
];

@Component({
  selector: 'app-worklist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TableModule,
    InputTextModule,
    ButtonModule,
    DropdownModule,
    ProgressSpinnerModule,
    TagModule,
  ],
  template: `
    <section class="worklist">
      <header>
        <h1>Worklist</h1>
        <div class="filters">
          <input
            type="text"
            pInputText
            placeholder="Modality (CT, MR…)"
            [ngModel]="modality()"
            (ngModelChange)="modality.set($event)"
            (keyup.enter)="refresh()"
          />
          <p-dropdown
            [options]="stateOptions"
            optionLabel="label"
            optionValue="value"
            [ngModel]="stateId()"
            (ngModelChange)="stateId.set($event); refresh()"
            placeholder="State"
          ></p-dropdown>
          <button pButton label="Refresh" (click)="refresh()"></button>
        </div>
      </header>

      <p-progressSpinner *ngIf="loading()" styleClass="spinner"></p-progressSpinner>

      <div *ngIf="!loading() && error()" class="error">{{ error() }}</div>

      <p-table
        *ngIf="!loading() && entries().length > 0"
        [value]="entries()"
        [paginator]="true"
        [rows]="limit()"
        [totalRecords]="total()"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>Study date</th>
            <th>Description</th>
            <th>Modalities</th>
            <th>Patient</th>
            <th>Institution</th>
            <th>State</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-row>
          <tr>
            <td>{{ row.studyCreatedAt | date: 'short' }}</td>
            <td>{{ row.studyDescription }}</td>
            <td>
              <p-tag *ngFor="let m of row.modalities" [value]="m" severity="info"></p-tag>
            </td>
            <td>{{ row.patName }} <small *ngIf="row.patBirthdate">({{ row.patBirthdate }})</small></td>
            <td>{{ row.institution }}</td>
            <td>{{ stateLabel(row.reportStateId) }}</td>
            <td>
              <a [routerLink]="['/radiologist/study', row.id]">Open</a>
            </td>
          </tr>
        </ng-template>
      </p-table>

      <p *ngIf="!loading() && entries().length === 0 && !error()" class="empty">
        No studies match the current filters.
      </p>
    </section>
  `,
  styles: [
    `
      :host { display: block; padding: 1.5rem; }
      header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
      .filters { display: flex; gap: 0.5rem; }
      .spinner { display: block; margin: 2rem auto; }
      .error { color: #b00020; }
      .empty { color: #666; }
    `,
  ],
})
export class WorklistComponent implements OnInit {
  private readonly service = inject(WorklistService);
  private readonly messages = inject(MessageService);

  readonly stateOptions = STATE_OPTIONS;
  readonly entries = signal<WorklistEntry[]>([]);
  readonly total = signal(0);
  readonly limit = signal(25);
  readonly offset = signal(0);
  readonly modality = signal<string>('');
  readonly stateId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  onLazyLoad(event: { first?: number; rows?: number }): void {
    if (event.first !== undefined) this.offset.set(event.first);
    if (event.rows !== undefined) this.limit.set(event.rows);
    this.refresh();
  }

  refresh(): void {
    const filters: WorklistFilters = {
      modality: this.modality() || undefined,
      stateId: this.stateId() ?? undefined,
      offset: this.offset(),
      limit: this.limit(),
    };
    this.loading.set(true);
    this.error.set(null);

    this.service
      .list(filters)
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message ?? 'Failed to load worklist');
          this.messages.add({
            severity: 'error',
            summary: 'Worklist',
            detail: this.error()!,
            life: 3000,
          });
          return of({ entries: [], total: 0, limit: filters.limit ?? 25, offset: filters.offset ?? 0 });
        }),
      )
      .subscribe((res) => {
        this.entries.set(res.entries);
        this.total.set(res.total);
        this.loading.set(false);
      });
  }

  stateLabel(id: number): string {
    return STATE_OPTIONS.find((o) => o.value === id)?.label ?? String(id);
  }
}
