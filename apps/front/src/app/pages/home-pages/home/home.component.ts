import { Component } from '@angular/core';
import { HostListener } from '@angular/core';
import { t } from '../../../shared/i18n/i18n';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: false
})
export class HomeComponent {
  t = t;
  isMobile = window.innerWidth < 768;

  @HostListener('window:resize', ['$event'])
  onResize(event: { target: { innerWidth: number; }; }) {
    this.isMobile = event.target.innerWidth < 768;
  }

}
