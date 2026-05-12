import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private displayDialog1 = new BehaviorSubject<boolean>(false);
  private displayDialog4 = new BehaviorSubject<boolean>(false);

  constructor() { }

  openDialog1() {
    this.displayDialog1.next(true);
  }

  closeDialog1() {
    this.displayDialog1.next(false);
  }

  openDialog4() {
    this.displayDialog4.next(true);
  }

  closeDialog4() {
    this.displayDialog4.next(false);
  }

  getDialog1Status() {
    return this.displayDialog1.asObservable();
  }

  getDialog4Status() {
    return this.displayDialog4.asObservable();
  }
}
