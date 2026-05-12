import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable, catchError, map, of } from 'rxjs';
import { Base } from '../models/service/Base.model';
import { Parameter, ParameterUUID, Question } from '../models/service/parameters.model';

@Injectable({
  providedIn: 'root'
})
export class ParametersService {

  constructor(private httpClient: HttpClient) { }

  getRol(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getRol`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getSpecialty(idRole: number = 0): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getSpecialty/${idRole}`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getContract(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getContract`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getModality(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getModality`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getProvince(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getProvince`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getGetTitle(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getGetTitle`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getGetTitleSpecialty(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getGetTitleSpecialty`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getGender(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getGender`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getCountry(idContinent: number = 0): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getCountry/${idContinent}`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getCity(idCountry: number): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getCity/${idCountry}`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getCurrentSituation(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getCurrentSituation`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getCountryCodeIban(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getCountryCodeIban`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getPreferenceQuestion(): Observable<Base<Question[]>> {
    return this.httpClient.get<Base<Question[]>>(`${environment.apiURL}/parameters/getPreferenceQuestion`)
      .pipe(
        map((respuesta: Base<Question[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Question[]>>(error.error);
        }));
  }

  getSalary(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getSalary`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getWorkload(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getWorkload`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getSchedule(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getSchedule`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getState(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getState`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getOfferValue(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getOfferValue`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getHospitals(): Observable<Base<ParameterUUID[]>> {
    return this.httpClient.get<Base<ParameterUUID[]>>(`${environment.apiURL}/parameters/getHospitals`)
      .pipe(
        map((respuesta: Base<ParameterUUID[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<ParameterUUID[]>>(error.error);
        }));
  }

  getPayMethod(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getPayMethod`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getResponsible(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getResponsible`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getVacant(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getVacant`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getCountriesBusiness(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getCountriesBusiness`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }

  getLevelEnglish(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiURL}/parameters/getLevelEnglish`)
      .pipe(
        map((respuesta: Base<Parameter[]>) => respuesta),
        catchError((error: HttpErrorResponse) => {
          console.error('An error occurred:', error);
          return of<Base<Parameter[]>>(error.error);
        }));
  }
  
}
