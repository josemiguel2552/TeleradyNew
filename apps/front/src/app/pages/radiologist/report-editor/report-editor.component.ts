import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { Subscription, debounceTime, firstValueFrom } from 'rxjs';
import { Subject } from 'rxjs';
import {
  ReportContents,
  ReportResponse,
  ReportSection,
  ReportState,
  ReportV2Service,
} from '../services/report-v2.service';
import { WorklistService } from '../services/worklist.service';
import { SignReportDialogComponent } from '../components/sign-report-dialog/sign-report-dialog.component';

const MODALITIES = ['CT', 'MR', 'RX', 'US', 'OTHER'] as const;

const DEFAULT_SECTIONS: Record<string, ReportSection[]> = {
  CT: [
    { key: 'technique', title: 'Técnica', body: '' },
    { key: 'findings', title: 'Hallazgos', body: '' },
    { key: 'conclusion', title: 'Conclusión', body: '' },
  ],
  MR: [
    { key: 'technique', title: 'Técnica', body: '' },
    { key: 'findings', title: 'Hallazgos', body: '' },
    { key: 'conclusion', title: 'Conclusión', body: '' },
  ],
  RX: [
    { key: 'findings', title: 'Hallazgos', body: '' },
    { key: 'conclusion', title: 'Conclusión', body: '' },
  ],
  US: [
    { key: 'findings', title: 'Hallazgos', body: '' },
    { key: 'conclusion', title: 'Conclusión', body: '' },
  ],
  OTHER: [
    { key: 'findings', title: 'Hallazgos', body: '' },
    { key: 'conclusion', title: 'Conclusión', body: '' },
  ],
};

@Component({
  selector: 'app-report-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    CardModule,
    DropdownModule,
    InputTextareaModule,
    TagModule,
    SignReportDialogComponent,
  ],
  template: `
    <section class="editor">
      <header>
        <h1>
          <a [routerLink]="['/radiologist/study', studyId()]">Study</a>
          <span class="separator">/</span>
          Report
        </h1>
        <div class="meta">
          <p-tag [value]="state()" [severity]="stateSeverity()"></p-tag>
          <span class="version">v{{ version() }}</span>
          <span *ngIf="saving()" class="saving">Saving…</span>
          <span *ngIf="!saving() && lastSavedAt()" class="saved">
            Saved {{ lastSavedAt() | date: 'shortTime' }}
          </span>
        </div>
      </header>

      <div class="controls">
        <p-dropdown
          [options]="modalities"
          [ngModel]="modality()"
          (ngModelChange)="onModalityChange($event)"
          placeholder="Modality"
          [disabled]="locked()"
        ></p-dropdown>
        <button
          pButton
          label="Sign"
          [disabled]="locked() || !hasContents()"
          (click)="openSignDialog()"
        ></button>
        <button
          pButton
          label="Send to hospital"
          severity="success"
          [disabled]="state() !== 'signed'"
          (click)="send()"
        ></button>
        <a *ngIf="pdfUrl()" pButton [href]="pdfUrl()!" target="_blank" rel="noopener">Open PDF</a>
      </div>

      <div *ngFor="let section of sections(); let idx = index" class="section">
        <h2>{{ section.title }}</h2>
        <textarea
          pInputTextarea
          rows="6"
          [disabled]="locked()"
          [ngModel]="section.body"
          (ngModelChange)="onSectionChange(idx, $event)"
        ></textarea>
      </div>

      <div *ngIf="error()" class="error">{{ error() }}</div>

      <app-sign-report-dialog
        [visible]="signDialogOpen()"
        [policy]="defaultPolicy()"
        (visibleChange)="signDialogOpen.set($event)"
        (sign)="confirmSign($event)"
      ></app-sign-report-dialog>
    </section>
  `,
  styles: [
    `
      :host { display: block; padding: 1.5rem; max-width: 960px; margin: 0 auto; }
      header { display: flex; justify-content: space-between; align-items: center; }
      header a { color: inherit; text-decoration: none; }
      .separator { color: #999; padding: 0 0.5rem; }
      .meta { display: flex; align-items: center; gap: 0.75rem; }
      .saving { color: #666; font-size: 0.85rem; }
      .saved { color: #2e7d32; font-size: 0.85rem; }
      .version { font-family: monospace; color: #666; }
      .controls { display: flex; gap: 0.5rem; margin: 1rem 0; }
      .section { margin: 1.25rem 0; }
      .section h2 { font-size: 1rem; color: #333; margin-bottom: 0.5rem; }
      textarea { width: 100%; font-family: inherit; }
      .error { color: #b00020; margin-top: 1rem; }
    `,
  ],
})
export class ReportEditorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly reports = inject(ReportV2Service);
  private readonly worklist = inject(WorklistService);
  private readonly messages = inject(MessageService);

  readonly modalities = MODALITIES.map((m) => ({ label: m, value: m }));
  readonly studyId = signal<string>('');
  readonly state = signal<ReportState>('draft');
  readonly version = signal<number>(0);
  readonly modality = signal<string>('CT');
  readonly sections = signal<ReportSection[]>([]);
  readonly pdfUrl = signal<string | null>(null);
  readonly lastSavedAt = signal<number | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly signDialogOpen = signal(false);
  readonly defaultPolicy = signal<'name_collegiate' | 'drawn_hash_tsa'>('name_collegiate');
  readonly locked = computed(() => this.state() === 'signed' || this.state() === 'sent');
  readonly hasContents = computed(() => this.sections().some((s) => s.body.trim().length > 0));

  private autosave$ = new Subject<void>();
  private sub: Subscription | null = null;

  constructor() {
    this.sub = this.autosave$
      .pipe(debounceTime(800))
      .subscribe(() => void this.persistDraft());
  }

  async ngOnInit(): Promise<void> {
    this.studyId.set(this.route.snapshot.paramMap.get('id') ?? '');
    if (!this.studyId()) {
      this.error.set('Missing study id');
      return;
    }
    try {
      const report = await firstValueFrom(this.reports.get(this.studyId()));
      this.applyReport(report);
    } catch (err: any) {
      if (err?.status === 404) {
        // No report yet → start blank with the default modality sections.
        this.sections.set(structuredClone(DEFAULT_SECTIONS.CT));
      } else {
        this.error.set(err?.error?.message ?? 'Failed to load report');
      }
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onSectionChange(idx: number, body: string): void {
    const next = [...this.sections()];
    next[idx] = { ...next[idx], body };
    this.sections.set(next);
    this.autosave$.next();
  }

  onModalityChange(modality: string): void {
    this.modality.set(modality);
    if (!this.hasContents()) {
      this.sections.set(structuredClone(DEFAULT_SECTIONS[modality] ?? DEFAULT_SECTIONS.OTHER));
    }
    this.autosave$.next();
  }

  openSignDialog(): void {
    this.signDialogOpen.set(true);
  }

  async confirmSign(payload: any): Promise<void> {
    try {
      const updated = await this.reports.sign(this.studyId(), payload);
      this.applyReport(updated);
      this.signDialogOpen.set(false);
      this.messages.add({ severity: 'success', summary: 'Report signed', life: 3000 });
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Sign failed');
      this.messages.add({ severity: 'error', summary: 'Sign failed', detail: this.error()!, life: 5000 });
    }
  }

  async send(): Promise<void> {
    try {
      const updated = await this.reports.send(this.studyId());
      this.applyReport(updated);
      this.messages.add({ severity: 'success', summary: 'Report sent', life: 3000 });
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Send failed');
    }
  }

  stateSeverity(): 'info' | 'warning' | 'success' | 'secondary' {
    switch (this.state()) {
      case 'draft': return 'info';
      case 'finalized': return 'warning';
      case 'signed': return 'success';
      case 'sent': return 'secondary';
    }
  }

  private async persistDraft(): Promise<void> {
    if (this.locked()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const contents: ReportContents = {
        modality: this.modality(),
        sections: this.sections(),
      };
      const updated = await this.reports.saveDraft(this.studyId(), contents);
      this.version.set(updated.version);
      this.state.set(updated.state);
      this.lastSavedAt.set(Date.now());
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Autosave failed');
    } finally {
      this.saving.set(false);
    }
  }

  private applyReport(report: ReportResponse): void {
    this.state.set(report.state);
    this.version.set(report.version);
    this.pdfUrl.set(report.pdfUrl);
    if (report.contents) {
      this.modality.set(report.contents.modality ?? 'CT');
      this.sections.set(report.contents.sections ?? []);
    } else {
      this.sections.set(structuredClone(DEFAULT_SECTIONS.CT));
    }
  }
}
