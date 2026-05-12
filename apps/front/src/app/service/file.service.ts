import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FileService {

  private typeFile = new Map([['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['png', 'image/png'], ['pdf', 'application/pdf']]);

  constructor() { }

  getBase64(file: File): Promise<string | ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        resolve(e.target ? e.target.result : null);
      };
      reader.onerror = e => {
        reject(e);
      };
      reader.readAsDataURL(file);
    });
  }

  getBase64Format(dataBase64: string, name: string): string {
    return 'data:' + this.typeFile.get(this.getTypeFile(name).toLowerCase()) + ';base64,' + dataBase64;
  }

  getTypeFile(name: string): string {
    const nameSplit = name.split('.');
    const type = nameSplit[nameSplit.length - 1];
    return type;
  }

  downloadPdf(name: string, dataBase64: string) {
    const downloadLink = document.createElement("a");

    downloadLink.href = dataBase64;
    downloadLink.download = name;
    downloadLink.click();
  }
}