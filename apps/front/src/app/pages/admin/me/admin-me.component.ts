import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { MeService } from '../services/me.service';
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
    `,
  ],
})
export class AdminMeComponent {
  private readonly me = inject(MeService);
  private readonly token = inject(TokenService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly busy = signal(false);

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
