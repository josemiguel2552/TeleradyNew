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
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { AdminService, AuditEntry, AuditVerifyResult } from '../services/admin.service';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    TableModule,
    TagModule,
  ],
  template: `
    <section class="audit">
      <header>
        <h1>Audit log</h1>
        <div class="controls">
          <input
            type="text"
            pInputText
            placeholder="Filter by action (e.g. report.signed)"
            [ngModel]="action()"
            (ngModelChange)="action.set($event)"
            (keyup.enter)="refresh()"
          />
          <button pButton label="Refresh" severity="secondary" (click)="refresh()"></button>
          <button pButton label="Verify chain" (click)="verify()" [loading]="verifying()"></button>
        </div>
      </header>

      <p-card *ngIf="verification() as v" [styleClass]="v.ok ? 'ok' : 'tamper'">
        <ng-container *ngIf="v.ok; else tamperBlock">
          <p-tag severity="success" value="OK"></p-tag>
          Chain verified across {{ v.checkedRows }} entries.
        </ng-container>
        <ng-template #tamperBlock>
          <p-tag severity="danger" value="TAMPER"></p-tag>
          First invalid entry: <code>{{ v.firstInvalidId }}</code>
          (after {{ v.checkedRows }} valid rows).
        </ng-template>
      </p-card>

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
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
            <th>Hash</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-row>
          <tr>
            <td>{{ row.ts | date: 'short' }}</td>
            <td>
              <code *ngIf="row.actorId">{{ row.actorId.slice(0, 8) }}…</code>
              <small *ngIf="row.actorRole">/ {{ row.actorRole }}</small>
            </td>
            <td>
              <p-tag [value]="row.action" severity="info"></p-tag>
            </td>
            <td>{{ row.targetKind }} <code>{{ row.targetId?.slice(0, 8) }}…</code></td>
            <td>
              <small>{{ row.hash.slice(0, 12) }}…</small>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </section>
  `,
  styles: [
    `
      :host { display: block; padding: 1.5rem; }
      header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
      .controls { display: flex; gap: 0.5rem; }
      :host ::ng-deep p-card.ok > div { border-left: 4px solid #4caf50; }
      :host ::ng-deep p-card.tamper > div { border-left: 4px solid #b00020; }
      code { font-family: ui-monospace, monospace; }
    `,
  ],
})
export class AdminAuditComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly messages = inject(MessageService);

  readonly entries = signal<AuditEntry[]>([]);
  readonly total = signal(0);
  readonly limit = signal(50);
  readonly offset = signal(0);
  readonly action = signal('');
  readonly verifying = signal(false);
  readonly verification = signal<AuditVerifyResult | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  onLazyLoad(event: { first?: number; rows?: number }): void {
    if (event.first !== undefined) this.offset.set(event.first);
    if (event.rows !== undefined) this.limit.set(event.rows);
    this.refresh();
  }

  refresh(): void {
    this.admin
      .listAudit({
        offset: this.offset(),
        limit: this.limit(),
        action: this.action() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.entries.set(res.entries);
          this.total.set(res.total);
        },
        error: (err) =>
          this.messages.add({
            severity: 'error',
            summary: 'Failed to load audit log',
            detail: err?.error?.message ?? 'Unknown error',
          }),
      });
  }

  async verify(): Promise<void> {
    this.verifying.set(true);
    try {
      const result = await this.admin.verifyAudit();
      this.verification.set(result);
      this.messages.add({
        severity: result.ok ? 'success' : 'error',
        summary: result.ok ? 'Audit chain OK' : 'Audit chain tampered',
        life: 4000,
      });
    } catch (err: any) {
      this.messages.add({
        severity: 'error',
        summary: 'Verify failed',
        detail: err?.error?.message ?? 'Unknown error',
      });
    } finally {
      this.verifying.set(false);
    }
  }
}
