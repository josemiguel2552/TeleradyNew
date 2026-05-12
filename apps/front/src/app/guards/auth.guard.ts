import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../service/auth.service';
import { of, switchMap } from 'rxjs';
import { Base } from '../models/service/Base.model';
import { TokensLogin } from '../models/service/auth.model';
import { TokenService } from '../service/token.service';
import { PersonalDataService } from '../service/personal-data.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const personalData = inject(PersonalDataService);

  const decodedToken: any = tokenService.decodeToken();
  if (decodedToken) {
    if (decodedToken.isHospital) {
      router.navigateByUrl('/hospital/login');
      return false;
    }

    if (tokenService.isAuthorized()) {
      return personalData.validate(decodedToken.email).pipe(
        switchMap((validResponse: Base<{ exists: boolean }>) => {
          if (validResponse.ok && validResponse.response?.exists) {
            return of(true);
          } else {
            router.navigateByUrl('/user/personalData');
            return of(false);
          }
        })
      );
    }

    if (!tokenService.isRefreshTokenExpired()) {
      const refreshToken = tokenService.getRefreshToken();
      const decoded: any = tokenService.decodeRefreshToken();
      return authService.refresh({ refreshToken, email: decoded.email }).pipe(
        switchMap((res: Base<TokensLogin>) => {
          if (!res.ok) {
            router.navigateByUrl('/user/login');
            return of(false);
          }
          else {
            return personalData.validate(decodedToken.email).pipe(
              switchMap((validResponse: Base<{ exists: boolean }>) => {
                if (validResponse.ok && validResponse.response?.exists) {
                  return of(true); 
                } else {
                  router.navigateByUrl('/user/personalData');
                  return of(false);
                }
              })
            );
          }
        })
      );
    }
  }

  router.navigateByUrl('/user/login');
  return false;
};

export const noNomalGuard: CanActivateFn = (route, state) => {
  const tokenService = inject(TokenService);
  const personalDataService = inject(PersonalDataService);
  const router = inject(Router);

  if (!tokenService.isAuthorized()) {
    router.navigateByUrl('/user/login');
    return false;
  }

  const decodedToken: any = tokenService.decodeToken();
  if (!decodedToken) {
    router.navigateByUrl('/user/login');
    return false;
  }

  return personalDataService.validate(decodedToken.email).pipe(
    switchMap((validResponse: Base<{ exists: boolean }>) => {
      if (validResponse.ok && validResponse.response?.exists) {
        router.navigateByUrl('/user/dashboard'); 
        return of(false);
      } else {
        return of(true); 
      }
    })
  );
};
