import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import {  Observable, of } from 'rxjs';
import { Base } from '../models/service/Base.model';
import { AuthLogin, AuthRefresh, AuthSigup, PassRefresh, TokensLogin } from '../models/service/auth.model';
import { TokenService } from './token.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private httpClient: HttpClient, private tokenService: TokenService) { }

  register(data: AuthSigup): Observable<Base<TokensLogin>> {
    return this.httpClient.post<Base<TokensLogin>>(`${environment.apiURL}/auth/sigup`, data)
      .pipe(
        map((respuesta: Base<TokensLogin>) => {
          if (respuesta.ok) {
            this.tokenService.saveTokens(respuesta.response.accessToken, respuesta.response.refreshToken);
          }
          return respuesta;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<TokensLogin>>(error.error);
        }));
  }

  login(data: AuthLogin): Observable<Base<TokensLogin>> {
    return this.httpClient.post<Base<TokensLogin>>(`${environment.apiURL}/auth/login`, data)
      .pipe(
        map((respuesta: Base<TokensLogin>) => {
          if (respuesta.ok) {
            this.tokenService.saveTokens(respuesta.response.accessToken, respuesta.response.refreshToken);
          }
          return respuesta;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<TokensLogin>>(error.error);
        }));
  }

  refresh(data: AuthRefresh): Observable<Base<TokensLogin>> {
    return this.httpClient.post<Base<TokensLogin>>(`${environment.apiURL}/auth/refresh`, data)
      .pipe(
        map((respuesta: Base<TokensLogin>) => {
          if (respuesta.ok) {
            this.tokenService.saveTokens(respuesta.response.accessToken, respuesta.response.refreshToken);
          }
          return respuesta;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<TokensLogin>>(error.error);
        }));
  }

  userOauth(data: AuthSigup): Observable<Base<TokensLogin>> {
    return this.httpClient.post<Base<TokensLogin>>(`${environment.apiURL}/auth/userOauth`, data)
      .pipe(
        map((respuesta: Base<TokensLogin>) => {
          if (respuesta.ok) {
            this.tokenService.saveTokens(respuesta.response.accessToken, respuesta.response.refreshToken);
          }
          return respuesta;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<TokensLogin>>(error.error);
        }));
  }

  recoverPass(email: string) {
    return this.httpClient.get<Base<any>>(`${environment.apiURL}/auth/recoverPass/${email}`)
      .pipe(
        map((respuesta: Base<any>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<any>>(error.error);
        }));
  }

  savePass(data: PassRefresh): Observable<Base<any>> {
    return this.httpClient.post<Base<any>>(`${environment.apiURL}/auth/savePass`, data)
      .pipe(
        map((respuesta: Base<any>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<any>>(error.error);
        }));
  }
}
