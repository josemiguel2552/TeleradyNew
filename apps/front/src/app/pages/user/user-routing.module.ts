import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './authPages/login/login.component';
import { RegisterComponent } from './authPages/register/register.component';
import { ForgotPassComponent } from './authPages/forgot-pass/forgot-pass.component';
import { RecoverPassComponent } from './authPages/recover-pass/recover-pass.component';
import { StudiesPageComponent } from './studiesPages/studies-pages.component';
import { DashboardPagesComponent } from './dashboardPages/dashboard-pages.component';
import { DocumentPageComponent } from './documentPages/document-pages.component';
import { StatisticPageComponent } from './statisticPages/statistic-pages.component';
import { ReportPagesComponent } from './report-pages/report-pages.component';
import { authGuard, noNomalGuard } from 'src/app/guards/auth.guard';
import { PersonalDataComponent } from './authPages/personal-data/personal-data.component';
import { StudyReportPagesComponent } from './study-report-pages/study-report-pages.component';

const routes: Routes = [
    { path: 'login',component: LoginComponent,},
    {path: 'register', component: RegisterComponent,},
    {path: 'forgotPass',component: ForgotPassComponent,},
    {path: 'personalData',component: PersonalDataComponent,canActivate: [noNomalGuard]},
    {path: 'recoverPass/:token',component: RecoverPassComponent,},

    { path: 'dashboard', component: DashboardPagesComponent,canActivate: [authGuard]},
    { path: 'studies', component: StudiesPageComponent,canActivate: [authGuard]},
    { path: 'statistic', component: StatisticPageComponent,canActivate: [authGuard]},
    { path: 'document', component: DocumentPageComponent, canActivate: [authGuard]},
    { path: 'report', component: ReportPagesComponent, canActivate: [authGuard]},
    { path: 'study-report', component: StudyReportPagesComponent, canActivate: [authGuard]},

];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class UserRoutingModule { }