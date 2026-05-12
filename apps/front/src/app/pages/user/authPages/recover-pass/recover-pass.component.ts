import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import jwt_decode from 'jwt-decode';
import * as dayjs from 'dayjs';
import { MessageService } from 'primeng/api';
import { Base } from '../../../../models/service/Base.model';
import { PassRefresh } from '../../../../models/service/auth.model';
import { AuthService } from '../../../../service/auth.service';
import { t } from '../../../../shared/i18n/i18n';

@Component({
  selector: 'app-recover-pass',
  templateUrl: './recover-pass.component.html',
  styleUrls: ['./recover-pass.component.scss'],
  standalone: false
})
export class RecoverPassComponent implements OnInit {
  t = t;

  formGroup = new FormGroup({
    password: new FormControl('', Validators.required),
    confirmPassword: new FormControl('', Validators.required)
  }, { validators: this.confirmPasswordValidator('password', 'confirmPassword') });

  token: string | undefined;
  loading: boolean = false;

  constructor(private authService: AuthService, private activatedroute: ActivatedRoute, private messageService: MessageService, private route: Router) { }

  ngOnInit(): void {
    this.token = this.activatedroute.snapshot.paramMap.get('token') ?? '';
    if (!this.verifyToken(this.token)) {
      this.messageService.add({ severity: 'warn', summary: t('recoverPass.summaryMessages'), detail: t('recoverPass.messages1') });
      this.route.navigateByUrl('/user/login');
    }
  }

  savePass() {
    if (this.formGroup.status === 'VALID') {
      this.loading = true;
      const data: PassRefresh = { password: this.formGroup.value.password ?? '', token: this.token ?? '' };
      this.authService.savePass(data).subscribe({
        next: (res: Base<any>) => {
          let severity;
          if (res.ok) {
            severity = 'success';
            this.route.navigateByUrl('/user/login');
          }
          else {
            severity = 'warn';
          }
          this.messageService.add({ severity: severity, summary: t('recoverPass.summaryMessages'), detail: res.message });
          this.loading = false;
        }
      });
    }
  }

  private verifyToken(token: string): boolean {
    if (!token || token.length < 2) {
      return false;
    }
    const decoded: any = jwt_decode(token);
    const dateString = dayjs.unix(decoded.exp).toDate();
    if (dateString > new Date() && !decoded.isNormal && decoded.typeToken === 'pass') {
      return true;
    } else {
      return false;
    }
  }

  private confirmPasswordValidator(controlName: string, matchingControlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const controlToCompare = control.get(controlName);
      const matchingControl = control.get(matchingControlName);

      if (controlToCompare && matchingControl && controlToCompare.value !== matchingControl.value) {
        return { mustMatch: true };
      }

      return null;
    };
  }

  showError(controlName: string): boolean {
    const control = this.formGroup.get(controlName);
    if (!control) return false;
    return control.invalid && (control.touched || control.dirty);
  }
}
