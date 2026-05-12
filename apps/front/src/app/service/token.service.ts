import { Injectable } from '@angular/core';
import jwt_decode from 'jwt-decode';
import * as dayjs from 'dayjs';
import { BehaviorSubject } from 'rxjs';
import { SocialAuthService } from '@abacritt/angularx-social-login';

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private oAuthService: SocialAuthService) { }

  get isLoggedIn$() {
    return this.loggedIn.asObservable();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('TokenBH');
  }

  nextLogged(vale: boolean) {
    this.loggedIn.next(vale);
  }

  logout(): void {
    localStorage.removeItem('TokenBH');
    localStorage.removeItem('RefreshTokenBH');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isOAuth');
    this.loggedIn.next(false);

    this.oAuthService.signOut(false).catch((err) => {
      console.warn('Error cerrando sesión OAuth:', err);
    });
  }

  getToken(): string {
    if (localStorage.getItem('TokenBH')) {
      return localStorage.getItem('TokenBH') ?? '';
    }
    return '';
  }
  
  getRawToken(): string {
    const token = this.getToken();
    return token.replace(/^Bearer\s/, '');
  }
  
  decodeToken(): any {
    const token = this.getToken();
    if (token && token != '')
      return jwt_decode(token);
    return null;
  }

  isAuthorized(): boolean {
    const token = this.getToken();
    if (!token || token.length < 2) {

      return false;
    }
    const decoded: any = jwt_decode(token);
    const dateString = dayjs.unix(decoded.exp).toDate();
    if (dateString > new Date()) {
      return true;
    } else {
      localStorage.removeItem('TokenBH');
      this.loggedIn.next(false);
      return false;
    }
  }

  isRefreshTokenExpired(): boolean {
    const token = this.getRefreshToken();
    if (!token || token.length < 2) {
      return true;
    }
    const decoded: any = jwt_decode(token);
    const dateString = dayjs.unix(decoded.exp).toDate();
    if (dateString > new Date()) {
      return false;
    } else {
      localStorage.removeItem('RefreshTokenBH');
      return true;
    }
  }

  saveTokens(token?: string, refreshToken?: string): void {
    if (token)
      localStorage.setItem('TokenBH', `Bearer ${token}`);
    if (refreshToken)
      localStorage.setItem('RefreshTokenBH', `${refreshToken}`);
    this.loggedIn.next(true);
  }

  getRefreshToken(): string {
    if (localStorage.getItem('RefreshTokenBH')) {
      return localStorage.getItem('RefreshTokenBH') ?? '';
    }
    return '';
  }

  getTokenForActualPacs(): string {
    const token = this.getToken();
    return token.replace(/^Bearer\s/, ''); // ✅ Quita el prefijo si existe
  }
  
  decodeRefreshToken(): any {
    const token = this.getRefreshToken();
    if (token && token != '')
      return jwt_decode(token);
    return null;
  }
}
