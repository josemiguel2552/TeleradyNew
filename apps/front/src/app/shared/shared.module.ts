import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtmlPipe } from './pipes/safe-html.pipe';
import { DialogModule } from 'primeng/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { DialogAlertComponent } from 'src/app/layout/components/modals/dialog-alert/dialog-alert.component';
import { UserRoutingModule } from '../pages/user/user-routing.module';


@NgModule({
    declarations: [
        SafeHtmlPipe,
        DialogAlertComponent,
    ],
    imports: [
        CommonModule,
        UserRoutingModule,
        DialogModule,
        FormsModule,
        ReactiveFormsModule,
        OverlayModule
    ],
    exports: [
        SafeHtmlPipe,
    ]
})
export class SharedModule { }