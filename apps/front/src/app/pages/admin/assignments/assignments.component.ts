import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { WorklistEntry, WorklistService } from '../../radiologist/services/worklist.service';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin-assignments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
  ],
  template: `
    <section class="assignments">
      <header>
        <h1>Study assignments</h1>
        <button pButton label="Refresh" severity="secondary" (click)="refresh()"></button>
      </header>

      <p-table
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
            <th>Hospital</th>
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
            <td><code>{{ row.hospitalId?.slice(0, 8) }}…</code></td>
            <td>
              <button pButton label="Assign" size="small" (click)="openAssign(row)"></button>
            </td>
          </tr>
        </ng-template>
      </p-table>

      <p-dialog
        [visible]="dialogOpen()"
        (visibleChange)="dialogOpen.set($event)"
        [modal]="true"
        header="Assign study"
        [style]="{ width: '32rem' }"
      >
        <p *ngIf="selected() as s">
          <strong>{{ s.studyDescription }}</strong> — {{ s.studyCreatedAt | date: 'short' }}
        </p>
        <div class="form">
          <label>
            Primary radiologist (UUID)
            <input
              type="text"
              pInputText
              [ngModel]="professionalId()"
              (ngModelChange)="professionalId.set($event)"
              placeholder="b1c…"
            />
          </label>
          <label>
            Reviewer (optional)
            <input
              type="text"
              pInputText
              [ngModel]="reviewerId()"
              (ngModelChange)="reviewerId.set($event)"
              placeholder="Leave empty to skip second read"
            />
          </label>
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" severity="secondary" (click)="dialogOpen.set(false)"></button>
          <button pButton label="Assign" [disabled]="!professionalId()" (click)="submit()"></button>
        </ng-template>
      </p-dialog>
    </section>
  `,
  styles: [
    `
      :host { display: block; padding: 1.5rem; }
      header { display: flex; justify-content: space-between; align-items: center; }
      .form { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem; }
      label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    `,
  ],
})
export class AdminAssignmentsComponent implements OnInit {
  private readonly worklist = inject(WorklistService);
  private readonly admin = inject(AdminService);
  private readonly messages = inject(MessageService);

  readonly entries = signal<WorklistEntry[]>([]);
  readonly total = signal(0);
  readonly limit = signal(25);
  readonly offset = signal(0);
  readonly dialogOpen = signal(false);
  readonly selected = signal<WorklistEntry | null>(null);
  readonly professionalId = signal<string>('');
  readonly reviewerId = signal<string>('');

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.worklist.list({ limit: this.limit(), offset: this.offset() }).subscribe({
      next: (res) => {
        this.entries.set(res.entries);
        this.total.set(res.total);
      },
      error: (err) =>
        this.messages.add({
          severity: 'error',
          summary: 'Failed to load worklist',
          detail: err?.error?.message ?? 'Unknown error',
        }),
    });
  }

  onLazyLoad(event: { first?: number; rows?: number }): void {
    if (event.first !== undefined) this.offset.set(event.first);
    if (event.rows !== undefined) this.limit.set(event.rows);
    this.refresh();
  }

  openAssign(entry: WorklistEntry): void {
    this.selected.set(entry);
    this.professionalId.set('');
    this.reviewerId.set('');
    this.dialogOpen.set(true);
  }

  async submit(): Promise<void> {
    const study = this.selected();
    if (!study) return;
    try {
      await this.admin.assign(study.id, this.professionalId(), this.reviewerId() || undefined);
      this.messages.add({ severity: 'success', summary: 'Study reassigned', life: 3000 });
      this.dialogOpen.set(false);
      this.refresh();
    } catch (err: any) {
      this.messages.add({
        severity: 'error',
        summary: 'Assignment failed',
        detail: err?.error?.message ?? 'Unknown error',
      });
    }
  }
}
