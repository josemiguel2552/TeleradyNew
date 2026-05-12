import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../../service/auth.service';
import { Base } from '../../../../models/service/Base.model';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TokensLogin } from '../../../../models/service/auth.model';
import { SocialAuthService, MicrosoftLoginProvider } from "@abacritt/angularx-social-login";
import { TokenService } from '../../../../service/token.service';
import { t } from '../../../../shared/i18n/i18n';
import { PersonalDataService } from '../../../../service/personal-data.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false
})
export class LoginComponent implements OnInit {
  t = t;
  loading: boolean = false;

  formGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.pattern("^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$")]),
    password: new FormControl('', Validators.required),
  });

  constructor(private authService: AuthService, private tokenService: TokenService, private route: Router, private messageService: MessageService, private oAuthService: SocialAuthService, private personalDataService: PersonalDataService) {
  }

  ngOnInit(): void {
    if (this.tokenService.isAuthorized()) {
      this.route.navigateByUrl('/user/offers');
      return;
    }
    this.oAuthService.authState.subscribe((user) => {
      if (user) {
        localStorage.removeItem('isOAuth');
        this.loading = true;
        this.gotNext(user);
      }
    });
  }

  loginOAuth(): void {
    this.oAuthService.authState.subscribe((user) => {
      this.loading = true;
      this.gotNext(user);
    });
  }

  login(): void {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.status === 'VALID') {
      this.loading = true;
      const data = {
        email: this.formGroup.value.email ?? '',
        password: this.formGroup.value.password ?? ''
      };

      this.authService.login(data).subscribe({
        next: (res: Base<TokensLogin>) => {
          if (res.ok) {
            this.tokenService.saveTokens(res.response.accessToken, res.response.refreshToken);
            localStorage.setItem('userEmail', data.email);
            console.log("guardo");

            this.personalDataService.validate(data.email).subscribe({
              next: (validResponse) => {
                if (validResponse.ok && validResponse.response?.exists) {
                  this.route.navigateByUrl('/user/dashboard');
                } else {
                  this.route.navigateByUrl('/user/personalData');
                }
              },
              error: (err) => {
                this.route.navigateByUrl('/user/personalData');
              }
            });

          } else {
            this.messageService.add({ severity: 'warn', summary: t('login.summaryMessages'), detail: res.message });
          }
          this.loading = false;
        }
      });
    }
  }

  gotNext(user: any): void {

    if (!user || !user.email) {
      this.messageService.add({
        severity: 'warn',
        summary: t('login.summaryMessages'),
        detail: 'Error: No se pudo obtener el email del usuario.'
      });
      this.loading = false;
      return;
    }

    const provider = user.provider?.toLowerCase().includes('microsoft') ? 'microsoft' : user.provider;

    this.authService.userOauth({ email: user.email, sessionType: user.provider, name: user.firstName, lastName: user.lastName }).subscribe({
      next: (res: Base<TokensLogin>) => {
        if (res.ok) {
          localStorage.removeItem('isOAuth');
          this.tokenService.saveTokens(res.response.accessToken, res.response.refreshToken);
          localStorage.setItem('userEmail', user.email);
          this.personalDataService.validate(user.email).subscribe({
            next: (validResponse) => {
              if (validResponse.ok && validResponse.response?.exists) {
                this.route.navigateByUrl('/user/dashboard');
              } else {
                this.route.navigateByUrl('/user/personalData');
              }
            },
          })
        }
        else {
          this.messageService.add({ severity: 'warn', summary: t('login.summaryMessages'), detail: res.message });
        }
        this.loading = false;
      }
    });
  }

  loginMicrosoft() {
    localStorage.setItem('isOAuth', 'true');
    this.oAuthService.signIn(MicrosoftLoginProvider.PROVIDER_ID);
  }

  showError(controlName: string): boolean {
    const control = this.formGroup.get(controlName);
    if (!control) return false;
    return control.invalid && (control.touched || control.dirty);
  }
}
