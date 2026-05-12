import { NgModule, provideAppInitializer } from '@angular/core';
import { environment } from '../environments/environment';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TokenInterceptor } from './interceptors/token.interceptor';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MessageService } from 'primeng/api';
import { SocialAuthServiceConfig, GoogleLoginProvider, MicrosoftLoginProvider } from '@abacritt/angularx-social-login';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { MarkdownModule } from 'ngx-markdown';
import Aura from '@primeng/themes/aura';
import { initializeTranslations } from './shared/i18n/i18n';


@NgModule({
    declarations: [
        AppComponent,
    ],
    bootstrap: [AppComponent],
    imports: [
        BrowserModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        MarkdownModule.forRoot(),
    ],
    providers: [
        provideAnimationsAsync(),
        providePrimeNG({
            theme: {
                preset: Aura,
                options: {
                    darkModeSelector: '.my-app-dark'
                }
            }
        }),
        provideAppInitializer(initializeTranslations()),
        { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
        {
            provide: 'SocialAuthServiceConfig',
            useValue: {
                autoLogin: false,
                providers: [
                    {
                        id: GoogleLoginProvider.PROVIDER_ID,
                        provider: new GoogleLoginProvider(environment.GOOGLE_CLIENT_ID)
                    },
                    {
                        id: MicrosoftLoginProvider.PROVIDER_ID,
                        provider: new MicrosoftLoginProvider(environment.MICROSOFT_CLIENT_ID)
                    },
                ],
                onError: (err) => {
                    console.error(err);
                }
            } as SocialAuthServiceConfig,
        },
        MessageService,
        provideHttpClient(withInterceptorsFromDi())
    ]
})
export class AppModule { }
