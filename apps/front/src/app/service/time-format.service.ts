import { Injectable } from '@angular/core';
import { DateTime } from 'luxon';

@Injectable({
  providedIn: 'root'
})
export class TimeFormatService {

  constructor() { }


  getNow(): string {
    const now = new Date();
    return now.toString();
  }

  formatDateTime(dateTime: string): string {
    const newDateTime = this.convertToUserTimeZone(dateTime);
    const now = new Date();
    const past = new Date(newDateTime);
    const diff = now.getTime() - past.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (hours < 1) {
      return `Hace ${minutes} ${minutes == 1 ? ' minuto' : ' minutos'}`;
    } else if (hours < 24) {
      return `Hace ${hours} ${hours == 1 ? ' hora' : ' horas'}`;
    } else if (days < 5) {
      return `Hace ${days} ${days == 1 ? ' día' : ' días'}`;
    } else {
      return past.toLocaleDateString('es-ES', { month: 'numeric', day: 'numeric', year: 'numeric' });
    }
  }

  formatDateTimeChat(dateTime: string): string {
    const newDateTime = this.convertToUserTimeZone(dateTime);
    const now = new Date();
    const past = new Date(newDateTime);
    const diff = now.getTime() - past.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return past.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return past.toLocaleDateString('es-ES', { month: 'numeric', day: 'numeric', year: 'numeric' });
    }
  }

  private getUserTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  convertToUserTimeZone(gmtDate: string): string {
    const userTimeZone = this.getUserTimeZone();
    const dateInUserTZ = DateTime.fromISO(gmtDate).setZone(userTimeZone);
    const dateString = dateInUserTZ.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ');
    return dateString
  }
}
