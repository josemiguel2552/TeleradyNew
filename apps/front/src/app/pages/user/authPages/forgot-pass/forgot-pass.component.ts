import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Base } from '../../../../models/service/Base.model';
import { AuthService } from '../../../../service/auth.service';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { t } from '../../../../shared/i18n/i18n';

@Component({
  selector: 'app-forgot-pass',
  templateUrl: './forgot-pass.component.html',
  styleUrls: ['./forgot-pass.component.scss'],
  standalone: false
})
export class ForgotPassComponent {
  t = t;

  formGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.pattern("^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$")]),
  });

  loading: boolean = false;

  constructor(private authService: AuthService, private messageService: MessageService, private route: Router) { }

  sendEmail(): void {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.status === 'VALID') {
      this.loading = true;
      const email = this.formGroup.value.email ?? '';
      this.authService.recoverPass(email).subscribe({
        next: (res: Base<any>) => {
          let severity;
          if (res.ok) {
            severity = 'success';
            this.route.navigateByUrl('/user/login');
          }
          else {
            severity = 'warn';
          }
          this.messageService.add({ severity: severity, summary: t('forgotPass.summaryMessages'), detail: res.message });
          this.loading = false;
        }
      });
    }
  }

  showError(controlName: string): boolean {
    const control = this.formGroup.get(controlName);
    if (!control) return false;
    return control.invalid && (control.touched || control.dirty);
  }
}
