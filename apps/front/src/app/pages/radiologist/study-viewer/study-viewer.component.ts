import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { StudiesService } from '../../../service/studies.service';
import { WorklistEntry, WorklistService } from '../services/worklist.service';

@Component({
  selector: 'app-study-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ButtonModule, CardModule, ProgressSpinnerModule],
  template: `
    <section class="viewer">
      <header>
        <h1>
          <a routerLink="/radiologist/worklist">Worklist</a>
          <span class="separator">/</span>
          <span>Study</span>
        </h1>
        <a
          *ngIf="entry()"
          class="open-report"
          [routerLink]="['/radiologist/study', entry()!.id, 'report']"
        >Edit report</a>
      </header>

      <p-progressSpinner *ngIf="loading()"></p-progressSpinner>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <p-card *ngIf="entry() as e" header="Patient">
        <dl>
          <dt>Name</dt>
          <dd>{{ e.patName ?? '—' }}</dd>
          <dt>Birthdate</dt>
          <dd>{{ e.patBirthdate ?? '—' }}</dd>
          <dt>Study date</dt>
          <dd>{{ e.studyCreatedAt | date: 'medium' }}</dd>
          <dt>Description</dt>
          <dd>{{ e.studyDescription ?? '—' }}</dd>
          <dt>Modalities</dt>
          <dd>{{ e.modalities.length ? e.modalities.join(', ') : '—' }}</dd>
          <dt>Institution</dt>
          <dd>{{ e.institution ?? '—' }}</dd>
        </dl>
      </p-card>

      <div *ngIf="viewerUrl()" class="ohif">
        <iframe
          [src]="viewerUrl()"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          referrerpolicy="no-referrer"
        ></iframe>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: grid; grid-template-rows: auto auto 1fr; height: 100%; padding: 1rem; gap: 1rem; }
      header { display: flex; align-items: center; justify-content: space-between; }
      header h1 { display: flex; align-items: center; gap: 0.5rem; }
      header a { color: inherit; text-decoration: none; }
      header .separator { color: #999; }
      .open-report { font-size: 0.9rem; padding: 0.4rem 0.75rem; border-radius: 6px; background: #1e88e5; color: #fff; }
      dl { display: grid; grid-template-columns: 140px 1fr; gap: 0.25rem 1rem; margin: 0; }
      dt { color: #666; }
      .ohif { height: 70vh; min-height: 480px; border-radius: 8px; overflow: hidden; }
      .ohif iframe { width: 100%; height: 100%; border: 0; background: #0b0d10; }
      .error { color: #b00020; }
    `,
  ],
})
export class StudyViewerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly worklist = inject(WorklistService);
  private readonly studies = inject(StudiesService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly entry = signal<WorklistEntry | null>(null);
  readonly viewerUrl = signal<SafeResourceUrl | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Missing study id');
      this.loading.set(false);
      return;
    }
    try {
      const entry = await this.worklist.get(id);
      this.entry.set(entry);
      const url = await this.studies.getViewerUrl(entry.studyInstanceUid);
      this.viewerUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Failed to load study');
    } finally {
      this.loading.set(false);
    }
  }
}
