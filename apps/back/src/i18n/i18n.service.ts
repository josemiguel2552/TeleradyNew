import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { t } from './i18n';

@Injectable()
export class I18nService {
    private currentLang = 'en';

    constructor() { }

    setLang(req: Request): void {
        const acceptLanguage = req.header('accept-language') ?? 'en';
        const lang = acceptLanguage.split(',')[0];
        this.currentLang = lang.split('-')[0];
    }

    getLang(): string {
        return this.currentLang;
    }

    translate(key: string): string {
        return t(key, this.currentLang);
    }
}
