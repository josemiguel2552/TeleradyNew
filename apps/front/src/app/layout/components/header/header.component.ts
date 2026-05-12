import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { TokenService } from '../../../service/token.service';
import { Router } from '@angular/router';
import { t } from '../../../shared/i18n/i18n';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: false
})

export class HeaderComponent implements OnInit, OnDestroy {
  t = t;

  private sub!: Subscription;
  private subMenu!: Subscription;
  private newMessageSubscription!: Subscription;
  private readMessageSubscription!: Subscription;
  isUserLoggedIn: boolean = false;
  hideMenuMobile: boolean = false;
  photo: string | null = null;
  isLoginActive = false;
  isMobile: boolean = false;

  infoUser = {
    name: null,
    email: null,
    specialty: null,
    sessionType: null,
    user_role: null,
    isNormal: false,
  }

  notifications = {
    bell: 0,
    document: 0,
    chest: 0
  }

  showImg: boolean = false;

  itemsMenuMobile = [
    { label: 'Inicio', icon: 'line-md:home-md-alt-twotone', path: '/user/dashboard' },
    { label: 'Informes', icon: 'line-md:briefcase', path: '/user/studies' },
    { label: 'Mensajes', icon: 'line-md:chat', path: '/user/profile/messages' },
    { label: 'My Statistic', icon: 'line-md:briefcase', path: '/user/StatisticPageComponent' },
    { label: 'Profile', icon: 'line-md:account', path: '/user/profile/messages' },
  ];

  elementActive: number | undefined = 0;

  constructor(private tokenService: TokenService,
    private route: Router) {
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.checkScreenSize();
    this.setSubscriptions();
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth <= 768;
  }

  private setSubscriptions(): void {
    this.sub = this.tokenService.isLoggedIn$.subscribe(
      (loggedIn) => {
        this.isUserLoggedIn = loggedIn;
        this.getInfo();
      });
  }

  private getInfo(): void {
    const decoded: any = this.tokenService.decodeToken();
    if (decoded) {
      this.showImg = true;
      this.infoUser = {
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        sessionType: decoded.sessionType ?? null,
        specialty: decoded.specialty ?? null,
        user_role: decoded.user_role ?? null,
        isNormal: decoded.isNormal
      }

      if (decoded.hasPhoto) {
        this.getPhoto();
      }
    }
    else
      this.showImg = false;
  }

  private getPhoto() {
  }

  logout() {
    localStorage.removeItem('isOAuth');
    this.tokenService.logout();
    this.route.navigateByUrl('/user/login');
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
    if (this.subMenu) this.subMenu.unsubscribe();
    if (this.newMessageSubscription) this.newMessageSubscription.unsubscribe();
    if (this.readMessageSubscription) this.readMessageSubscription.unsubscribe();
  }

  setElement(i: number) {
    this.elementActive = i;
  }
}
