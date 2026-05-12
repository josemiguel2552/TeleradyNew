import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { catchError, Observable, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../service/auth.service';
import { Base } from '../models/service/Base.model';
import { TokensLogin } from '../models/service/auth.model';
import { TokenService } from '../service/token.service';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
    private route: Router,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isOwnApi =
      request.url.includes(environment.apiURL) || request.url.includes(environment.apiTelerady);
    if (!isOwnApi) {
      return next.handle(request);
    }

    const decoded: any = this.tokenService.decodeToken();
    if (!decoded) {
      return next.handle(request);
    }

    if (this.tokenService.isAuthorized()) {
      return next.handle(this.addTokenHeader(request, this.tokenService.getToken()));
    }

    if (this.tokenService.isRefreshTokenExpired()) {
      this.navigateToLogin();
      return next.handle(request);
    }

    const refreshToken = this.tokenService.getRefreshToken();
    const decodedRefresh: any = this.tokenService.decodeRefreshToken();

    return this.authService.refresh({ refreshToken, email: decodedRefresh.email }).pipe(
      switchMap((res: Base<TokensLogin>) => {
        if (!res.ok) {
          this.route.navigateByUrl('/user/login');
          return next.handle(request);
        }
        return next.handle(this.addTokenHeader(request, res.response.accessToken));
      }),
      catchError(() => {
        this.navigateToLogin();
        return next.handle(request);
      }),
    );
  }

  private addTokenHeader(request: HttpRequest<unknown>, token: string = ''): HttpRequest<unknown> {
    return request.clone({
      setHeaders: { Authorization: token },
    });
  }

  private navigateToLogin(): void {
    this.route.navigateByUrl('/user/login');
  }
}
