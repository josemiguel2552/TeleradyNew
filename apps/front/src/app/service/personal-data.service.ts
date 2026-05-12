import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { Base } from '../models/service/Base.model';
import { PersonalData } from '../models/service/personal-data.model';
import { Parameter } from '../models/service/parameters.model';

@Injectable({
  providedIn: 'root'
})
export class PersonalDataService {

  constructor(private httpClient: HttpClient) { }

  savePersonalData(data: PersonalData): Observable<Base<any>> {
    return this.httpClient.put<Base<any>>(`${environment.apiTelerady}/personal-data`, data)
      .pipe(
        map((response: Base<any>) => {
          return response;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al guardar datos personales:', error);
          return of<Base<any>>(error.error);
        })
      );
  }

  validate(email: string): Observable<Base<{ exists: boolean }>> {
    return this.httpClient.get<Base<{ exists: boolean }>>(`${environment.apiTelerady}/personal-data/validate?email=${email}`)
      .pipe(map(response => {
        return response;
      }),
        catchError(error => {
          console.error("Error al validate usuario:", error);
          return of<Base<{ exists: boolean }>>(error.error);
        })
      );
  }

  getSubSpecialties(): Observable<Base<Parameter[]>> {
    return this.httpClient.get<Base<Parameter[]>>(`${environment.apiTelerady}/parameters/subSpecialties`)
      .pipe(
        catchError(error => {
          console.error("Error al obtener subespecialidades:", error);
          return of<Base<Parameter[]>>(error.error);
        })
      );
  }
}
