import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { DialogAlertComponent } from 'src/app/layout/components/modals/dialog-alert/dialog-alert.component';
import { UserRoutingModule } from '../pages/user/user-routing.module';
import { OhifViewerComponent } from './components/ohif-viewer/ohif-viewer.component';

@NgModule({
  declarations: [DialogAlertComponent, OhifViewerComponent],
  imports: [
    CommonModule,
    UserRoutingModule,
    DialogModule,
    FormsModule,
    ReactiveFormsModule,
    OverlayModule,
  ],
  exports: [OhifViewerComponent],
})
export class SharedModule {}
