import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { StudiesService } from '../../../service/studies.service';

/**
 * Embeds the in-house OHIF viewer in a sandboxed iframe.
 *
 * The viewer URL is built by the backend (`/v1/pacs/viewer/:studyUid`) so
 * the SPA stays free of viewer-host knowledge. PostMessage events from the
 * frame are accepted only if `event.origin` matches the iframe origin.
 */
@Component({
  selector: 'app-ohif-viewer',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ohif-wrapper">
      <div *ngIf="loading" class="ohif-status">Loading viewer…</div>
      <div *ngIf="error" class="ohif-status ohif-error">{{ error }}</div>
      <iframe
        *ngIf="safeUrl"
        #frame
        class="ohif-iframe"
        [src]="safeUrl"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        referrerpolicy="no-referrer"
        (load)="onLoad()"
      ></iframe>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .ohif-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 480px;
        background: #0b0d10;
      }
      .ohif-iframe {
        width: 100%;
        height: 100%;
        border: 0;
      }
      .ohif-status {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ddd;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1;
      }
      .ohif-error {
        color: #ff7f7f;
      }
    `,
  ],
})
export class OhifViewerComponent implements OnChanges, OnDestroy {
  @Input() studyInstanceUid: string | null = null;

  @ViewChild('frame', { static: false }) frame?: ElementRef<HTMLIFrameElement>;

  safeUrl: SafeResourceUrl | null = null;
  loading = false;
  error: string | null = null;
  private allowedOrigin: string | null = null;

  constructor(
    private readonly studies: StudiesService,
    private readonly sanitizer: DomSanitizer,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!('studyInstanceUid' in changes)) return;
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.safeUrl = null;
  }

  private async refresh(): Promise<void> {
    this.safeUrl = null;
    this.error = null;
    if (!this.studyInstanceUid) return;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const url = await this.studies.getViewerUrl(this.studyInstanceUid);
      this.allowedOrigin = safeOrigin(url);
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    } catch (err) {
      this.error = (err as Error).message || 'Failed to load viewer';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onLoad(): void {
    this.loading = false;
    this.cdr.markForCheck();
  }

  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent): void {
    // Reject any message whose origin doesn't match the iframe.
    if (!this.allowedOrigin || event.origin !== this.allowedOrigin) return;
    // Hook for Sprint 5: viewer-emitted events such as "study-loaded",
    // "measurement-added", etc. land here once OHIF is wired to talk back.
  }
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
