import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../service/auth.service';
import { TokenService } from '../service/token.service';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  private refreshing = false;
  private refreshedToken$ = new BehaviorSubject<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly router: Router,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isOwnApi =
      request.url.includes(environment.apiURL) ||
      request.url.includes(environment.apiTelerady);
    if (!isOwnApi) {
      return next.handle(request);
    }

    return next.handle(this.attachToken(request)).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 401) return throwError(() => error);
        // Avoid loops on the auth endpoints themselves.
        if (request.url.includes('/auth/login') || request.url.includes('/auth/refresh')) {
          return throwError(() => error);
        }
        return this.handle401(request, next);
      }),
    );
  }

  private attachToken(request: HttpRequest<unknown>): HttpRequest<unknown> {
    const token = this.tokenService.getRawToken();
    const setHeaders: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    return request.clone({ withCredentials: true, setHeaders });
  }

  private handle401(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (this.refreshing) {
      return this.refreshedToken$.pipe(
        filter((token): token is string => !!token),
        take(1),
        switchMap(() => next.handle(this.attachToken(request))),
      );
    }

    this.refreshing = true;
    this.refreshedToken$.next(null);

    return this.authService.refresh().pipe(
      switchMap((res) => {
        this.refreshing = false;
        if (!res.ok) {
          this.tokenService.clearSession();
          this.router.navigateByUrl('/user/login');
          return throwError(() => res);
        }
        const newToken = res.response.accessToken;
        this.refreshedToken$.next(newToken);
        return next.handle(this.attachToken(request));
      }),
      catchError((err) => {
        this.refreshing = false;
        this.tokenService.clearSession();
        this.router.navigateByUrl('/user/login');
        return throwError(() => err);
      }),
    );
  }
}
