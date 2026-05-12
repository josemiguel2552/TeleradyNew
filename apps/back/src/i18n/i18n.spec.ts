import { t } from "./i18n";

jest.mock("./locales/en.json", () => ({
    greeting: "Hello",
    nested: {
        message: "Welcome!",
    },
}), { virtual: true });

jest.mock("./locales/es.json", () => ({
    greeting: "Hola",
    nested: {
        message: "¡Bienvenido!",
    },
}), { virtual: true });

describe("t() Translation Function", () => {
    afterAll(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it("should return the correct translation in English", () => {
        expect(t("greeting", "en")).toBe("Hello");
        expect(t("nested.message", "en")).toBe("Welcome!");
    });

    it("should return the correct translation in Spanish", () => {
        expect(t("greeting", "es")).toBe("Hola");
        expect(t("nested.message", "es")).toBe("¡Bienvenido!");
    });

    it("should fallback to English if translation is missing in Spanish", () => {
        expect(t("nested.unknown", "es")).toBe("[nested.unknown not found]");
    });

    it("should fallback to default English if locale is not specified", () => {
        expect(t("greeting")).toBe("Hello");
    });

    it("should return [key not found] if translation does not exist in any language", () => {
        expect(t("unknown.key", "fr")).toBe("[unknown.key not found]");
    });
});
