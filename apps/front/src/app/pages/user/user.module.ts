import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserRoutingModule } from './user-routing.module';
import { GoogleSigninButtonModule, SocialLoginModule } from '@abacritt/angularx-social-login';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { StepsModule } from 'primeng/steps';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabel } from 'primeng/floatlabel';
import { DialogModule } from 'primeng/dialog';
import { PaginatorModule } from 'primeng/paginator';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { LoginComponent } from './authPages/login/login.component';
import { ForgotPassComponent } from './authPages/forgot-pass/forgot-pass.component';
import { RecoverPassComponent } from './authPages/recover-pass/recover-pass.component';
import { DialogAlertComponent } from 'src/app/layout/components/modals/dialog-alert/dialog-alert.component';
import { RegisterComponent } from './authPages/register/register.component';
import { PersonalDataComponent } from './authPages/personal-data/personal-data.component';
import { DocumentPageComponent } from './documentPages/document-pages.component';
import { StudiesPageComponent } from './studiesPages/studies-pages.component';
import { StatisticPageComponent } from './statisticPages/statistic-pages.component';
import { ReportPagesComponent } from './report-pages/report-pages.component';
import { StudyReportPagesComponent } from './study-report-pages/study-report-pages.component';

@NgModule({
    declarations: [
        LoginComponent,
        ForgotPassComponent,
        RegisterComponent,
        RecoverPassComponent,
        DocumentPageComponent,
        DialogAlertComponent,
        PersonalDataComponent,
        StudiesPageComponent,
        StatisticPageComponent,
        ReportPagesComponent,
        StudyReportPagesComponent
    ],
    imports: [
        CommonModule,
        UserRoutingModule,
        FormsModule,
        ReactiveFormsModule,
        ProgressSpinnerModule,
        CalendarModule,
        ButtonModule,
        BadgeModule,
        StepsModule,
        InputTextModule,
        DialogModule,
        DropdownModule,
        FloatLabel,
        PaginatorModule,
        SocialLoginModule,
        GoogleSigninButtonModule,
        MarkdownModule
    ],
})
export class UserModule { }
