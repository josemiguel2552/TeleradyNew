import { Test, TestingModule } from '@nestjs/testing';
import { AuthGoogleService } from './auth-google.service';
import { decryptDataKey } from '../../../common/utils/crypto/crypto.util';
import { google } from 'googleapis';

jest.mock('../../../common/utils/crypto/crypto.util', () => ({
  decryptDataKey: jest.fn(),
}));

jest.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: jest.fn(),
    },
  },
}));

describe('AuthGoogleService', () => {
  let service: AuthGoogleService;

  beforeEach(async () => {
    process.env.GOOGLE_CLIENT_EMAIL = 'test-client-email@google.com';
    process.env.GOOGLE_PRIVATE_KEY = 'test-private-key';

    (decryptDataKey as jest.Mock).mockImplementation((key: string) => key);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthGoogleService],
    }).compile();

    service = module.get<AuthGoogleService>(AuthGoogleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize the JWT client with correct parameters', () => {
    expect(google.auth.JWT).toHaveBeenCalledWith(
      'test-client-email@google.com',
      undefined,
      'test-private-key'.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
    );
  });

  it('should return the JWT client instance', () => {
    const jwtClient = service.getClient();
    expect(jwtClient).toBeDefined();
    expect(jwtClient).toBeInstanceOf(google.auth.JWT);
  });

  it('should throw an error if GOOGLE_CLIENT_EMAIL is not defined', () => {
    delete process.env.GOOGLE_CLIENT_EMAIL;

    expect(() => {
      new AuthGoogleService();
    }).toThrowError('Google client email or private key is not defined in environment variables.');
  });

  it('should throw an error if GOOGLE_PRIVATE_KEY is not defined', () => {
    delete process.env.GOOGLE_PRIVATE_KEY;

    expect(() => {
      new AuthGoogleService();
    }).toThrowError('Google client email or private key is not defined in environment variables.');
  });

});
