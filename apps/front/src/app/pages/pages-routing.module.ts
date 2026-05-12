import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BaseLayoutComponent } from '../layout/base-layout/base-layout.component';

const routes: Routes = [{
    path: '',
    component: BaseLayoutComponent,
    children: [
        { path: '', redirectTo: '/home', pathMatch: 'full' },
        {
            path: 'home',
            loadChildren: () => import('./home-pages/home-pages.module').then(m => m.HomePagesModule)
        },
        {
            path: 'user',
            loadChildren: () => import('./user/user.module').then(m => m.UserModule)
        },
    ]
}];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class PagesRoutingModule { }