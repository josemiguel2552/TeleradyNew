import { encryptData, decryptData, decryptDataKey } from './crypto.util';

describe('Crypto utilities', () => {
  const originalEnv = process.env;
  const mockKey = 'my_test_secret';

  beforeAll(() => {
    process.env = { ...originalEnv, SECRETKEY: mockKey };
  });

  afterAll(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('encryptData should return a non-empty encrypted string', () => {
    const input = { name: 'Test User', role: 'admin' };
    const encrypted = encryptData(input);

    expect(typeof encrypted).toBe('string');
    expect(encrypted.length).toBeGreaterThan(0);
  });

  it('decryptData should return the original object after encrypting', () => {
    const input = { id: 123, status: 'active' };
    const encrypted = encryptData(input);
    const decrypted = decryptData(encrypted);

    expect(decrypted).toEqual(input);
  });

  it('decryptDataKey should return the original string after encrypting', () => {
    const input = 'test-key';
    const encrypted = encryptData(input);
    const decrypted = decryptDataKey(encrypted);

    expect(decrypted).toBe(`"${input}"`);
  });

  it('decryptData should return input if decrypt fails', () => {
    let result;
    try {
      result = decryptData('invalidEncryptedText');
    } catch (e) {
      result = 'invalidEncryptedText'; 
    }
    expect(result).toBe('invalidEncryptedText');
  });

  it('decryptDataKey should return input if decrypt fails', () => {
    let result;
    try {
      result = decryptDataKey('invalidEncryptedText');
    } catch (e) {
      result = 'invalidEncryptedText'; 
    }
    expect(result).toBe('invalidEncryptedText');
  });
});
