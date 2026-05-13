import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { MeService } from '../services/me.service';
import { PushSubscriptionService } from '../../../service/push-subscription.service';
import { TokenService } from '../../../service/token.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-me',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule, CardModule, ConfirmDialogModule],
  providers: [ConfirmationService],
  template: `
    <section class="me">
      <p-card header="My data (RGPD art. 15)">
        <p>Download a JSON dump with everything we hold about your account.</p>
        <button pButton label="Download data export" (click)="downloadExport()" [disabled]="busy()"></button>
      </p-card>

      <p-card header="Push notifications">
        <ng-container *ngIf="push.supported(); else unsupported">
          <p>
            Recibe avisos en este dispositivo cuando se te asigna un estudio
            o llega uno urgente. Las notificaciones solo viajan con el
            consentimiento explícito del navegador.
          </p>
          <p class="status">
            Permiso del navegador: <strong>{{ push.permission() }}</strong> ·
            Estado: <strong>{{ push.enabled() ? 'activadas' : 'desactivadas' }}</strong>
          </p>
          <button
            *ngIf="!push.enabled()"
            pButton
            label="Activar notificaciones"
            [disabled]="busy() || push.permission() === 'denied'"
            (click)="enablePush()"
          ></button>
          <button
            *ngIf="push.enabled()"
            pButton
            severity="secondary"
            label="Desactivar notificaciones"
            [disabled]="busy()"
            (click)="disablePush()"
          ></button>
          <p *ngIf="push.permission() === 'denied'" class="hint">
            El navegador tiene bloqueadas las notificaciones para Telerady.
            Cambia el permiso en la configuración del sitio para volver a activarlas.
          </p>
        </ng-container>
        <ng-template #unsupported>
          <p>Este navegador no soporta Web Push (RFC 8292).</p>
        </ng-template>
      </p-card>

      <p-card header="Delete my account (RGPD art. 17)" styleClass="danger">
        <p>
          Tombstones the account immediately: your email and personal fields are anonymised,
          MFA is removed and every active session is revoked. Signed reports remain auditable
          under art. 17.3.b RGPD.
        </p>
        <button
          pButton
          severity="danger"
          label="Delete my account"
          [disabled]="busy()"
          (click)="confirmDelete()"
        ></button>
      </p-card>

      <p-confirmDialog></p-confirmDialog>
    </section>
  `,
  styles: [
    `
      :host { display: block; padding: 1.5rem; max-width: 720px; margin: 0 auto; }
      :host ::ng-deep .danger .p-card { border: 1px solid #f3c2c2; }
      :host > ::ng-deep .p-card { margin-bottom: 1rem; }
      .status { font-size: 0.9rem; color: #555; }
      .hint { font-size: 0.85rem; color: #b54708; margin-top: 0.5rem; }
    `,
  ],
})
export class AdminMeComponent implements OnInit {
  private readonly me = inject(MeService);
  private readonly token = inject(TokenService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  readonly push = inject(PushSubscriptionService);

  readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    // Pre-fill the "enabled" signal if the browser already has a sub
    // registered for our SW. This way the toggle reflects the truth
    // on a page refresh even before the user clicks anything.
    if (!this.push.supported() || typeof navigator === 'undefined') return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) this.push.enabled.set(true);
    } catch {
      /* registration may not exist yet — fine */
    }
  }

  async enablePush(): Promise<void> {
    this.busy.set(true);
    try {
      const ok = await this.push.enable();
      this.messages.add({
        severity: ok ? 'success' : 'warn',
        summary: ok ? 'Notificaciones activadas' : 'No se pudieron activar',
        life: 3000,
      });
    } catch (err: any) {
      this.messages.add({
        severity: 'error',
        summary: 'Push falló',
        detail: err?.message ?? 'Unknown error',
      });
    } finally {
      this.busy.set(false);
    }
  }

  async disablePush(): Promise<void> {
    this.busy.set(true);
    try {
      await this.push.disable();
      this.messages.add({ severity: 'success', summary: 'Notificaciones desactivadas', life: 3000 });
    } catch (err: any) {
      this.messages.add({
        severity: 'error',
        summary: 'Push falló',
        detail: err?.message ?? 'Unknown error',
      });
    } finally {
      this.busy.set(false);
    }
  }

  async downloadExport(): Promise<void> {
    this.busy.set(true);
    try {
      await this.me.downloadExport();
      this.messages.add({ severity: 'success', summary: 'Export downloaded', life: 3000 });
    } catch (err: any) {
      this.messages.add({
        severity: 'error',
        summary: 'Export failed',
        detail: err?.error?.message ?? 'Unknown error',
      });
    } finally {
      this.busy.set(false);
    }
  }

  confirmDelete(): void {
    this.confirm.confirm({
      header: 'Delete account?',
      message:
        'This anonymises your account permanently. You will be signed out immediately. Continue?',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        this.busy.set(true);
        try {
          await this.me.deleteAccount();
          this.token.logout();
          this.router.navigateByUrl('/login');
        } catch (err: any) {
          this.messages.add({
            severity: 'error',
            summary: 'Delete failed',
            detail: err?.error?.message ?? 'Unknown error',
          });
        } finally {
          this.busy.set(false);
        }
      },
    });
  }
}
