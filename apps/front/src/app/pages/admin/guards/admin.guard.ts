import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from '../../../service/token.service';

const ADMIN_LIKE_ROLES = ['admin', 'coordinator', 'hospital_admin'];

export const adminGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (!tokenService.isAuthorized()) {
    router.navigateByUrl('/user/login');
    return false;
  }
  const decoded: any = tokenService.decodeToken();
  const roles: string[] = decoded?.roles ?? [];
  if (!roles.some((r) => ADMIN_LIKE_ROLES.includes(r))) {
    router.navigateByUrl('/user/login');
    return false;
  }
  return true;
};
