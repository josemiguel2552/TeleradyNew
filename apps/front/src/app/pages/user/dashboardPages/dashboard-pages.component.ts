import { Component, OnInit, HostListener } from '@angular/core';
import { TokenService } from '../../../service/token.service';
import { t } from '../../../shared/i18n/i18n';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard-pages',
  templateUrl: './dashboard-pages.component.html',
  styleUrl: './dashboard-pages.component.scss',
  standalone: false
})

export class DashboardPagesComponent implements OnInit {
  isMobile = window.innerWidth < 768;
  t = t;

  @HostListener('window:resize', ['$event'])
  onResize(event: { target: { innerWidth: number; }; }) {
    this.isMobile = event.target.innerWidth < 768;
  }

  infoUser = {
    name: null,
    email: null,
    specialty: null
  };

  constructor(private tokenService : TokenService, private router : Router){}

  ngOnInit(): void {
    this.getUserInfo();
  }

  private getUserInfo(): void {
    const decoded: any = this.tokenService.decodeToken();
    if (decoded) {
      this.infoUser = {
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        specialty: decoded.specialty ?? null
      };
    }
  }

  navigateToReport() {
    this.router.navigate(['/user/report']);
  }

}
