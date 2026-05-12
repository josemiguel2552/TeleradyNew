import yaml from 'js-yaml';

type Translations = {
    [key: string]: string | Translations;
};
let translationsLoaded = false;

async function loadYamlSync(lang: string): Promise<any> {
    try {
        const response = await fetch(`/assets/locales/${lang}.yaml`);
        const text = await response.text();
        return yaml.load(text);
    } catch (error) {
        console.log(`Error loanding ${lang}.yaml`, error);
        return undefined;
    }
}

const translations: Record<string, Translations> = {};

export async function loadTranslations() {
    const lang = getLang();
    translations[lang] = await loadYamlSync(lang);
    translationsLoaded = true;
}

function getLang(): string {
    let langNav = navigator.language || navigator.languages[0];
    langNav = langNav.split('-')[0];
    const lang = ['en', 'es'].includes(langNav) ? langNav : 'en';
    return lang;
}

export function t(key: string): string {
    if (!translationsLoaded) {
        console.log("No ready the texts");
        return `[${key} not ready]`;
    }

    const lang = getLang();

    const keys = key.split('.');
    let result: string | Translations | undefined = translations[lang];

    for (const k of keys)
        if (typeof result === 'object' && result !== null) {
            result = result[k];
        } else {
            result = undefined;
            break;
        }

    if (typeof result !== 'string') {
        let fallbackResult: string | Translations | undefined = translations['en'];
        for (const k of keys)
            if (typeof fallbackResult === 'object' && fallbackResult !== null) {
                fallbackResult = fallbackResult[k];
            } else {
                fallbackResult = undefined;
                break;
            }
        return typeof fallbackResult === 'string' ? fallbackResult : `[${key} not found]`;
    }

    return result;
}

export function setTranslationsLoaded(value: boolean): void {
    translationsLoaded = value;
}

export function initializeTranslations(): () => Promise<void> {
    return async () => {
        await loadTranslations();
    };
}