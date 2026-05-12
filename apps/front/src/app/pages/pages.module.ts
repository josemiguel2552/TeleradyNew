import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { PagesRoutingModule } from './pages-routing.module';
import { BaseLayoutComponent } from '../layout/base-layout/base-layout.component';
import { HeaderComponent } from '../layout/components/header/header.component';
import { FooterComponent } from '../layout/components/footer/footer.component';

@NgModule({
    declarations: [
        BaseLayoutComponent,
        HeaderComponent,
        FooterComponent,
    ],
    imports: [
        CommonModule,
        PagesRoutingModule,
        ToastModule,
    ],
    
})
export class PagesModule { }