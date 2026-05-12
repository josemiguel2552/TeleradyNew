import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BaseLayoutComponent } from '../layout/base-layout/base-layout.component';

const routes: Routes = [{
    path: '',
    component: BaseLayoutComponent,
    children: [
        // Default landing now points at the canonical login.
        { path: '', redirectTo: '/login', pathMatch: 'full' },
        // Legacy /user/** is stubbed to /login. The whole legacy tree
        // is kept compiling so any cached deep link in someone's
        // browser still resolves to a usable page; a later sprint
        // deletes the files outright.
        { path: 'user', redirectTo: '/login', pathMatch: 'prefix' },
        {
            path: 'home',
            loadChildren: () => import('./home-pages/home-pages.module').then(m => m.HomePagesModule)
        },
    ]
}];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class PagesRoutingModule { }