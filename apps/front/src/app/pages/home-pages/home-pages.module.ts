import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomePagesRoutingModule } from './home-pages-routing.module';
import { HomeComponent } from './home/home.component';

@NgModule({
    imports: [
        CommonModule,
        HomePagesRoutingModule,
    ],
    declarations: [
        HomeComponent,
    ]
})
export class HomePagesModule { }