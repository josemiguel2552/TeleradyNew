import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from '../../../service/token.service';

/**
 * Lets the radiologist work area through only if the current JWT has the
 * `radiologist` role. Anything else is bounced to /user/login.
 *
 * The backend re-verifies the role on every request — this guard is a UX
 * shortcut, not a security boundary.
 */
export const radiologistGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (!tokenService.isAuthorized()) {
    router.navigateByUrl('/user/login');
    return false;
  }
  const decoded: any = tokenService.decodeToken();
  const roles: string[] = decoded?.roles ?? [];
  if (!roles.includes('radiologist') && !roles.includes('admin') && !roles.includes('coordinator')) {
    router.navigateByUrl('/user/login');
    return false;
  }
  return true;
};
