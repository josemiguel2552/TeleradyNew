import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportService {

  private apiUrl = environment.apiUrlradiogenia;
  private apiKey = 'rdg_RFO17C4DEZTBCNPXG5H4ZPWIJW0S05VKWUYD0JIQ1hqh0c';

  constructor(private http: HttpClient) { }

  private getLangauge() {
    const lang = navigator.language || 'en';
    return lang.startsWith('es') ? 'es' : 'en';
  }

  getReports(): Observable<any> {
    const language = navigator.language.startsWith('es') ? 'es' : 'en';
    const url = `${this.apiUrl}/reports/${language}`;
    const headers = new HttpHeaders({
      'X-API-Key': this.apiKey
    });
    console.log("Llamando a API:", url);
    console.log("Headers enviados:", headers);

    return this.http.get(url, { headers });
  }
  
  generateReport(findings: string, reportTitle: string): Observable<string> {
    const url = `${this.apiUrl}/genreport`;
    const headers = new HttpHeaders({
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json'
    });

    const body = {
      findings,
      report_title: reportTitle,
      language: this.getLangauge()
    };

    return new Observable<string>(observer => {
      fetch(url, {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }).then(response => {
        if (!response.ok) throw new Error(`Error: ${response.status} ${response.statusText}`);
        return response.body;
      }).then(body => {
        const reader = body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";
        const readStream = () => {
          if (!reader) return;
          reader.read().then(({ done, value }) => {
            if (done) {
              if (accumulatedText.trim().length > 0) {
                observer.next(accumulatedText);
              }
              observer.complete();
              return;
            }
            const chunk = decoder.decode(value, { stream: true });
            accumulatedText += chunk;
            let lines = accumulatedText.split("\n");
            accumulatedText = lines.pop() || "";
            lines.forEach(line => observer.next(line));
            readStream();
          });
        };
        readStream();
      }).catch(error => {
        observer.error(error);
      });
    });
  }


}
