import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../service/auth.service';
import { TokenService } from '../../service/token.service';

/**
 * Standalone login page used during demos and as the default entry point
 * for the new portals. Decodes the JWT after login and redirects the user
 * to the right area based on their roles.
 */
@Component({
  selector: 'app-login-v2',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ButtonModule, CardModule, InputTextModule, PasswordModule],
  template: `
    <main class="login">
      <p-card header="Telerady">
        <p class="hint">Sign in to enter the radiologist or admin portal.</p>
        <form (submit)="$event.preventDefault(); submit()" autocomplete="on">
          <label>
            Email
            <input
              type="email"
              autocomplete="username"
              pInputText
              [ngModel]="email()"
              (ngModelChange)="email.set($event); error.set(null)"
              name="email"
              required
            />
          </label>
          <label>
            Password
            <p-password
              [feedback]="false"
              [toggleMask]="true"
              [ngModel]="password()"
              (ngModelChange)="password.set($event); error.set(null)"
              [inputStyle]="{ width: '100%' }"
              [style]="{ width: '100%' }"
              name="password"
              required
            ></p-password>
          </label>
          <label>
            TOTP (only if MFA is enabled)
            <input
              type="text"
              pInputText
              [ngModel]="totp()"
              (ngModelChange)="totp.set($event); error.set(null)"
              name="totp"
              inputmode="numeric"
              autocomplete="one-time-code"
            />
          </label>

          <div *ngIf="error()" class="error">{{ error() }}</div>

          <button
            pButton
            type="submit"
            label="Sign in"
            [loading]="busy()"
            [disabled]="busy() || !email() || !password()"
          ></button>
        </form>
      </p-card>
    </main>
  `,
  styles: [
    `
      :host { display: grid; min-height: 100vh; place-items: center; background: #f3f4f6; }
      .login { width: min(420px, 92vw); }
      p.hint { color: #555; margin-top: 0; }
      form { display: flex; flex-direction: column; gap: 0.85rem; }
      label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #444; }
      .error { color: #b00020; font-size: 0.9rem; }
      :host ::ng-deep .p-password,
      :host ::ng-deep .p-password input { width: 100%; }
    `,
  ],
})
export class LoginV2Component {
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(TokenService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly email = signal('');
  readonly password = signal('');
  readonly totp = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.auth.login({
          email: this.email().trim(),
          password: this.password(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totp: this.totp() || undefined,
        } as any),
      );
      if (!res.ok) {
        this.error.set(res.message || 'Invalid credentials');
        return;
      }
      const decoded: any = this.tokens.decodeToken();
      const roles: string[] = decoded?.roles ?? [];
      const next = this.routeForRoles(roles);
      this.messages.add({ severity: 'success', summary: `Welcome`, detail: this.email(), life: 1500 });
      this.router.navigateByUrl(next);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Login failed');
    } finally {
      this.busy.set(false);
    }
  }

  private routeForRoles(roles: string[]): string {
    if (roles.includes('radiologist')) return '/radiologist/worklist';
    if (roles.includes('admin') || roles.includes('coordinator') || roles.includes('hospital_admin')) {
      return '/admin/sla';
    }
    return '/admin/me';
  }
}
