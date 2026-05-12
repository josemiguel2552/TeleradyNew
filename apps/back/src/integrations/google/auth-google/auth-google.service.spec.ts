import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { AuthGoogleService } from './auth-google.service';

jest.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: jest.fn(),
    },
  },
}));

const makeConfig = (overrides: Record<string, string | undefined> = {}): ConfigService =>
  ({
    get: (key: string) => overrides[key],
  } as unknown as ConfigService);

describe('AuthGoogleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initialises the JWT client with the configured credentials', () => {
    const config = makeConfig({
      GOOGLE_CLIENT_EMAIL: 'svc@telerady.iam.gserviceaccount.com',
      GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----',
    });

    new AuthGoogleService(config);

    expect(google.auth.JWT).toHaveBeenCalledWith(
      'svc@telerady.iam.gserviceaccount.com',
      undefined,
      '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----',
      ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
    );
  });

  it('throws when GOOGLE_CLIENT_EMAIL is missing', () => {
    const config = makeConfig({ GOOGLE_PRIVATE_KEY: 'k' });
    expect(() => new AuthGoogleService(config)).toThrow(/GOOGLE_CLIENT_EMAIL/);
  });

  it('throws when GOOGLE_PRIVATE_KEY is missing', () => {
    const config = makeConfig({ GOOGLE_CLIENT_EMAIL: 'svc@example.com' });
    expect(() => new AuthGoogleService(config)).toThrow(/GOOGLE_PRIVATE_KEY/);
  });
});
