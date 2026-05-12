import { Component, OnInit } from '@angular/core';
import { t } from '../../../shared/i18n/i18n';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: false
})
export class FooterComponent implements OnInit {
  t = t;

  constructor() { }

  ngOnInit(): void {
  }
}
