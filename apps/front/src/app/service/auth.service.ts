import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Base } from '../models/service/Base.model';
import {
  AuthLogin,
  AuthRefresh,
  AuthSigup,
  PassRefresh,
  TokensLogin,
} from '../models/service/auth.model';
import { TokenService } from './token.service';

interface LoginResponseV1 {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    roles: string[];
    hospitals: string[];
    professionalId: string | null;
    mfaEnabled: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${environment.apiTelerady}/auth`;

  constructor(private httpClient: HttpClient, private tokenService: TokenService) {}

  login(data: AuthLogin): Observable<Base<TokensLogin>> {
    return this.httpClient
      .post<LoginResponseV1>(`${this.base}/login`, data, { withCredentials: true })
      .pipe(
        map((response) => {
          this.tokenService.setSession(response.accessToken, response.user.email);
          return {
            ok: true,
            message: 'ok',
            response: {
              accessToken: response.accessToken,
              refreshToken: '',
            },
          } as Base<TokensLogin>;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('login failed:', error.status);
          return of<Base<TokensLogin>>({
            ok: false,
            message: error.error?.message ?? 'login failed',
            response: { accessToken: '', refreshToken: '' },
          } as Base<TokensLogin>);
        }),
      );
  }

  refresh(_data?: AuthRefresh): Observable<Base<TokensLogin>> {
    return this.httpClient
      .post<LoginResponseV1>(`${this.base}/refresh`, {}, { withCredentials: true })
      .pipe(
        map((response) => {
          this.tokenService.setSession(response.accessToken, response.user.email);
          return {
            ok: true,
            message: 'ok',
            response: {
              accessToken: response.accessToken,
              refreshToken: '',
            },
          } as Base<TokensLogin>;
        }),
        catchError((error: HttpErrorResponse) => {
          this.tokenService.clearSession();
          return of<Base<TokensLogin>>({
            ok: false,
            message: error.error?.message ?? 'refresh failed',
            response: { accessToken: '', refreshToken: '' },
          } as Base<TokensLogin>);
        }),
      );
  }

  logout(): Observable<void> {
    return this.httpClient
      .post<void>(`${this.base}/logout`, {}, { withCredentials: true })
      .pipe(
        map(() => {
          this.tokenService.clearSession();
        }),
        catchError(() => {
          this.tokenService.clearSession();
          return of(void 0);
        }),
      );
  }

  // -----------------------------------------------------------------
  // Legacy endpoints — not exposed by the new backend. Kept as stubs so
  // components compile while Sprint 4 / Sprint 6 redesign the affected
  // pages. Calling them returns an explicit error.
  // -----------------------------------------------------------------

  register(_data: AuthSigup): Observable<Base<TokensLogin>> {
    return this.notImplemented('register');
  }

  userOauth(_data: AuthSigup): Observable<Base<TokensLogin>> {
    return this.notImplemented('userOauth');
  }

  recoverPass(_email: string): Observable<Base<any>> {
    return this.notImplemented('recoverPass');
  }

  savePass(_data: PassRefresh): Observable<Base<any>> {
    return this.notImplemented('savePass');
  }

  private notImplemented<T>(name: string): Observable<Base<T>> {
    console.warn(`AuthService.${name}: legacy endpoint not available in v1`);
    return throwError(() => ({ ok: false, message: `${name} not available` }));
  }
}
