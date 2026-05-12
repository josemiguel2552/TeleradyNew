import { Injectable } from '@angular/core';
import jwt_decode from 'jwt-decode';
import { BehaviorSubject } from 'rxjs';
import { SocialAuthService } from '@abacritt/angularx-social-login';

interface SessionState {
  accessToken: string | null;
  expiresAtMs: number | null;
  userEmail: string | null;
}

/**
 * In-memory session store.
 *
 * The refresh token lives in an httpOnly cookie set by the backend. The
 * SPA only ever holds the access token (in memory) and the expiry derived
 * from its `exp` claim. localStorage is no longer used — closing the
 * XSS exfiltration window.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private state: SessionState = {
    accessToken: null,
    expiresAtMs: null,
    userEmail: null,
  };
  private readonly loggedIn = new BehaviorSubject<boolean>(false);

  constructor(private oAuthService: SocialAuthService) {}

  get isLoggedIn$() {
    return this.loggedIn.asObservable();
  }

  nextLogged(value: boolean): void {
    this.loggedIn.next(value);
  }

  setSession(accessToken: string, userEmail?: string | null): void {
    let expiresAtMs: number | null = null;
    try {
      const decoded: any = jwt_decode(accessToken);
      if (decoded?.exp) expiresAtMs = decoded.exp * 1000;
    } catch {
      expiresAtMs = null;
    }
    this.state = { accessToken, expiresAtMs, userEmail: userEmail ?? null };
    this.loggedIn.next(true);
  }

  clearSession(): void {
    this.state = { accessToken: null, expiresAtMs: null, userEmail: null };
    this.loggedIn.next(false);
  }

  /**
   * Backwards-compatible alias used by legacy callers. Refresh tokens are no
   * longer handled by the SPA, so the second argument is ignored.
   */
  saveTokens(token?: string, _refreshToken?: string): void {
    if (token) this.setSession(token);
  }

  logout(): void {
    this.clearSession();
    this.oAuthService.signOut(false).catch((err) => {
      console.warn('Error closing OAuth session:', err);
    });
  }

  getToken(): string {
    return this.state.accessToken ?? '';
  }

  getRawToken(): string {
    return this.getToken().replace(/^Bearer\s/, '');
  }

  decodeToken(): any {
    const token = this.getRawToken();
    if (!token) return null;
    try {
      return jwt_decode(token);
    } catch {
      return null;
    }
  }

  /**
   * True if there is a non-expired access token. We trust the SPA's clock;
   * the API still verifies the token signature and `exp` on every request.
   */
  isAuthorized(): boolean {
    if (!this.state.accessToken) return false;
    if (!this.state.expiresAtMs) return false;
    return this.state.expiresAtMs > Date.now();
  }

  /**
   * Legacy: the refresh cookie is httpOnly so the SPA cannot observe it.
   * Callers should treat the cookie as opaque and rely on /auth/refresh.
   */
  isRefreshTokenExpired(): boolean {
    return !this.state.accessToken;
  }

  getRefreshToken(): string {
    return '';
  }

  decodeRefreshToken(): any {
    return null;
  }

  getUserEmail(): string | null {
    return this.state.userEmail ?? this.decodeToken()?.email ?? null;
  }
}
