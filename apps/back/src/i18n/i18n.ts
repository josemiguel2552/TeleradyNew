import en from './locales/en.json';
import es from './locales/es.json';

type Translations = {
    [key: string]: string | Translations;
};

const translations: Record<string, Translations> = { en, es };

export function t(key: string, locale: string = 'en'): string {
    const lang = locale.split('-')[0];

    const keys = key.split('.');
    let result: string | Translations | undefined = translations[lang];

    for (const k of keys) {
        if (typeof result === 'object' && result !== null) {
            result = result[k];
        } else {
            result = undefined;
            break;
        }
    }

    if (typeof result !== 'string') {
        let fallbackResult: string | Translations | undefined = translations['en'];
        for (const k of keys) {
            if (typeof fallbackResult === 'object' && fallbackResult !== null) {
                fallbackResult = fallbackResult[k];
            } else {
                fallbackResult = undefined;
                break;
            }
        }
        return typeof fallbackResult === 'string' ? fallbackResult : `[${key} not found]`;
    }

    return result;
}