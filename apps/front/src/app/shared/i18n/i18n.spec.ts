import { t, loadTranslations, setTranslationsLoaded } from "./i18n";

(globalThis as any).fetch = jest.fn((url: string) => {
  let responseText = "";
  if (url.includes("en.yaml")) {
    responseText = `
      greeting: "Hello"
      nested:
        message: "Welcome!"
    `;
  } else if (url.includes("es.yaml")) {
    responseText = `
      greeting: "Hola"
      nested:
        message: "¡Bienvenido!"
    `;
  }
  return Promise.resolve({
    text: () => Promise.resolve(responseText),
  });
}) as jest.Mock;

jest.mock("js-yaml", () => ({
  load: jest.fn((text: string) => {
    if (text.includes("Hello")) {
      return { greeting: "Hello", nested: { message: "Welcome!" } };
    } else if (text.includes("Hola")) {
      return { greeting: "Hola", nested: { message: "¡Bienvenido!" } };
    }
    return {};
  }),
}));

describe("t() Translation Function", () => {
  beforeAll(async () => {
    jest.restoreAllMocks();
    await loadTranslations();
    Object.defineProperty(navigator, "language", { value: "es-ES", configurable: true });
    await loadTranslations();
  });

  it("should call fetch for both English and Spanish YAML files", async () => {
    expect((globalThis as any).fetch).toHaveBeenCalledWith("/assets/locales/en.yaml");
    expect((globalThis as any).fetch).toHaveBeenCalledWith("/assets/locales/es.yaml");
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(2);
  });

  it("should return the correct translation in English", () => {
    Object.defineProperty(navigator, "language", { value: "en-US", configurable: true });
    expect(t("greeting")).toBe("Hello");
    expect(t("nested.message")).toBe("Welcome!");
  });

  it("should return the correct translation in Spanish", () => {
    Object.defineProperty(navigator, "language", { value: "es-ES", configurable: true });
    expect(t("greeting")).toBe("Hola");
    expect(t("nested.message")).toBe("¡Bienvenido!");
  });

  it("should return '[key not found]' if translation does not exist", () => {
    Object.defineProperty(navigator, "language", { value: "en-US", configurable: true });
    expect(t("unknown.key")).toBe("[unknown.key not found]");
  });

  it("should return '[key not ready]' if translations are not loaded", () => {
    Object.defineProperty(navigator, "language", { value: "es-ES", configurable: true });
    setTranslationsLoaded(false);
    expect(t("greeting")).toBe("[greeting not ready]");
  });
});