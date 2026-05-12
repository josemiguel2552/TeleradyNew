import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { type_alert } from '../../../../enum/constants.enum';

@Component({
    selector: 'app-dialog-alert',
    templateUrl: './dialog-alert.component.html',
    styleUrls: ['./dialog-alert.component.scss'],
    standalone: false
})
export class DialogAlertComponent {
  isMobile = window.innerWidth < 768;
  visibleDialog4 = false;
  type_alert = type_alert;

  @Input() visible: boolean = false;
  @Input() validateR: { subTitle: string, message: string }[] = [];
  @Input() typeAlert: number = type_alert.requirements;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() acceptEvent = new EventEmitter<boolean>();

  message: string = '';

  @HostListener('window:resize', ['$event'])
  onResize(event: { target: { innerWidth: number } }) {
    this.isMobile = event.target.innerWidth < 768;
  }

  setData(message: string, typeAlert: number | null = null) {
    this.message = message;
    if (typeAlert) this.typeAlert = typeAlert;
  }

  closeDialog() {
    this.visible = false;
    this.visibleChange.emit(this.visible);
  }

  accept() {
    this.acceptEvent.emit();
    this.closeDialog();
  }

  getWindowWidth(): string {
    if (window.innerWidth < 768) {
      return '90vw';
    } else {
      return '50vw';
    }
  }

}
