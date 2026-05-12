import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { AdminService, SlaDashboard } from '../services/admin.service';

@Component({
  selector: 'app-admin-sla',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, TagModule, ProgressSpinnerModule, ButtonModule],
  template: `
    <section class="sla">
      <header>
        <h1>SLA dashboard</h1>
        <button pButton label="Refresh" severity="secondary" (click)="refresh()"></button>
      </header>

      <p-progressSpinner *ngIf="loading()"></p-progressSpinner>
      <div *ngIf="!loading() && error()" class="error">{{ error() }}</div>

      <div *ngIf="data() as d" class="grid">
        <p-card header="Pending">
          <strong class="big">{{ d.pendingCount }}</strong>
          <small>studies awaiting sign</small>
        </p-card>

        <p-card header="Over SLA">
          <strong class="big" [class.warn]="d.overSlaCount > 0">{{ d.overSlaCount }}</strong>
          <small>over {{ d.slaMinutes / 60 }} h since acquisition</small>
        </p-card>

        <p-card header="Avg time to sign">
          <strong class="big">{{ d.avgMinutesToSign | number: '1.0-1' }} <span>min</span></strong>
        </p-card>

        <p-card header="Avg sign → sent">
          <strong class="big">{{ d.avgMinutesSignToSent | number: '1.0-1' }} <span>min</span></strong>
        </p-card>

        <p-card header="By state" class="states">
          <div class="row"><span>Unreported</span><p-tag severity="warning" [value]="d.counts.unreported"></p-tag></div>
          <div class="row"><span>Draft</span><p-tag severity="info" [value]="d.counts.draft"></p-tag></div>
          <div class="row"><span>Finalized</span><p-tag severity="info" [value]="d.counts.finalized"></p-tag></div>
          <div class="row"><span>Signed</span><p-tag severity="success" [value]="d.counts.signed"></p-tag></div>
          <div class="row"><span>Sent</span><p-tag severity="secondary" [value]="d.counts.sent"></p-tag></div>
        </p-card>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; padding: 1.5rem; }
      header { display: flex; justify-content: space-between; align-items: center; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem; }
      .big { font-size: 2rem; font-weight: 600; }
      .big.warn { color: #b00020; }
      .big span { font-size: 0.9rem; color: #666; font-weight: 400; }
      .states .row { display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid #eee; }
      .states .row:last-child { border-bottom: none; }
      .error { color: #b00020; }
    `,
  ],
})
export class AdminSlaComponent implements OnInit {
  private readonly admin = inject(AdminService);

  readonly data = signal<SlaDashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const value = await firstValueFrom(this.admin.sla());
      this.data.set(value);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Failed to load SLA');
    } finally {
      this.loading.set(false);
    }
  }
}
