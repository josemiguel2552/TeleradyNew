import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../../service/auth.service';
import { Base } from '../../../../models/service/Base.model';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TokensLogin } from '../../../../models/service/auth.model';
import { MicrosoftLoginProvider, SocialAuthService } from "@abacritt/angularx-social-login";
import { t } from '../../../../shared/i18n/i18n';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  standalone: false
})
export class RegisterComponent implements OnInit {
  t = t;

  loading: boolean = false;

  formGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.pattern("^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$")]),
    password: new FormControl('', Validators.required)
  });

  constructor(private authService: AuthService, private route: Router, private messageService: MessageService, private oAuthService: SocialAuthService) {
  }

  ngOnInit(): void {
    const token = localStorage.getItem('TokenBH');
    const isOAuth = localStorage.getItem('isOAuth') === 'true';
    if (token) {
      this.route.navigateByUrl('/user/personalData');
      return;
    }
    if (isOAuth) {
      const sub = this.oAuthService.authState.subscribe((user) => {
        if (user) {
          this.loading = true;
          this.gotNext(user);
        }
        sub.unsubscribe();
      });
    }
  }

  loginOAuth() {
    this.oAuthService.authState.subscribe((user) => {
      this.loading = true;
      this.gotNext(user);
    });
  }

  sigup(): void {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.status === 'VALID') {
      this.loading = true;
      const data = {
        email: this.formGroup.value.email ?? '',
        password: this.formGroup.value.password ?? '',
      }
      this.authService.register(data).subscribe({
        next: (res: Base<TokensLogin>) => {
          let severity;
          if (res.ok) {
            severity = 'success';
            localStorage.setItem('userEmail', this.formGroup.value.email ?? '');
            this.route.navigateByUrl('/user/personalData');
          }
          else {
            severity = 'error';
          }
          this.messageService.add({ severity: severity, summary: t('register.summaryMessages'), detail: res.message });
          this.loading = false;
        }
      })
    }
  }

  gotNext(user: any): void {
    if (!user || !user.email) {
      this.messageService.add({
        severity: 'warn',
        summary: t('register.summaryMessages'),
        detail: t('register.errorMessages.errorGetEmail')
      });
      this.loading = false;
      return;
    }
  
    const provider = user.provider?.toLowerCase().includes('microsoft') ? 'microsoft' : user.provider;  
    this.authService.userOauth({ email: user.email, sessionType: user.provider, name: user.firstName, lastName: user.lastName }).subscribe({
      next: (res: Base<TokensLogin>) => {
        if (res.ok) {
          localStorage.removeItem('isOAuth');
          if (res.response.newUser)
            this.route.navigateByUrl('/user/newUser');
          else
            this.route.navigateByUrl('/user/offers');
        }
        else {
          this.messageService.add({ severity: 'warn', summary: t('register.summaryMessages'), detail: res.message });
        }
        this.loading = false;
      }
    });
  }

  registerMicrosoft() {
    localStorage.setItem('isOAuth', 'true');
    this.oAuthService.signIn(MicrosoftLoginProvider.PROVIDER_ID);
  }

  showError(controlName: string): boolean {
    const control = this.formGroup.get(controlName);
    if (!control) return false;
    return control.invalid && (control.touched || control.dirty);
  }
}
