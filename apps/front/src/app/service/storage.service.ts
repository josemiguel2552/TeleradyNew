import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private filter: any = null;

  constructor() { }

  setFilter(filters: any): void {
    this.filter = filters;
  }

  getFilter(): any {
    return this.filter;
  }

  clearFilter(): void {
    this.filter = null;
  }
}
