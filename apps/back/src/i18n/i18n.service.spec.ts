import { Test, TestingModule } from "@nestjs/testing";
import { Request } from 'express';
import { I18nService } from "./i18n.service";
import { t } from "./i18n";

jest.mock('./i18n', () => ({
    t: jest.fn((key: string, lang: string) => `${key}_${lang}`),
}));

describe('I18nService', () => {
    let service: I18nService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [I18nService],
        }).compile();

        service = module.get<I18nService>(I18nService);
    });

    afterAll(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('setLang', () => {
        it('should set the language based on the "accept-language" header', () => {
            const mockRequest = {
                header: jest.fn().mockReturnValue('es-ES,es;q=0.9'),
            } as unknown as Request;

            service.setLang(mockRequest);

            expect(mockRequest.header).toHaveBeenCalledWith('accept-language');
            expect(service.getLang()).toBe('es');
        });

        it('should default to "en" if "accept-language" header is not provided', () => {
            const mockRequest = {
                header: jest.fn().mockReturnValue(undefined),
            } as unknown as Request;

            service.setLang(mockRequest);

            expect(mockRequest.header).toHaveBeenCalledWith('accept-language');
            expect(service.getLang()).toBe('en');
        });
    });

    describe('getLang', () => {
        it('should return the current language', () => {
            service['currentLang'] = 'fr';
            expect(service.getLang()).toBe('fr');
        });
    });

    describe('translate', () => {
        it('should call the "t" function with the correct key and language', () => {
            service['currentLang'] = 'de';
            const result = service.translate('test.key');

            expect(t).toHaveBeenCalledWith('test.key', 'de');
            expect(result).toBe('test.key_de');
        });
    });
});