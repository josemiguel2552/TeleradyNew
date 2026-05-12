import { ConfigService } from '@nestjs/config';
import { OrthancClient } from './orthanc-client.service';

function makeClient(env: Record<string, string | undefined> = {}): OrthancClient {
  const cfg = {
    get: (key: string) => env[key],
    getOrThrow: (key: string) => {
      const value = env[key];
      if (value === undefined) throw new Error(`missing ${key}`);
      return value;
    },
  } as unknown as ConfigService;
  return new OrthancClient(cfg);
}

describe('OrthancClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('does not crash on init when ORTHANC_URL is missing (unit test environment)', () => {
    const client = makeClient();
    expect(() => client.onModuleInit()).not.toThrow();
  });

  it('proxies a request adding the basic auth header and stripping the trailing slash', async () => {
    const client = makeClient({
      ORTHANC_URL: 'http://orthanc:8042/',
      ORTHANC_USER: 'u',
      ORTHANC_PASSWORD: 'p',
      ORTHANC_DICOMWEB_PATH: '/dicom-web',
    });
    client.onModuleInit();

    const fetchMock = jest.fn().mockResolvedValue({ status: 200, headers: new Headers(), body: null });
    (global as any).fetch = fetchMock;

    await client.proxy('GET', '/system', { Accept: 'application/json' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://orthanc:8042/system',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('u:p').toString('base64')}`,
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('throws when used before configuration', async () => {
    const client = makeClient();
    client.onModuleInit();
    await expect(client.proxy('GET', '/system', {})).rejects.toThrow(/not configured/);
  });

  it('dicomWebProxy prefixes the configured root', async () => {
    const client = makeClient({
      ORTHANC_URL: 'http://orthanc:8042',
      ORTHANC_USER: 'u',
      ORTHANC_PASSWORD: 'p',
      ORTHANC_DICOMWEB_PATH: '/dicom-web',
    });
    client.onModuleInit();

    const fetchMock = jest.fn().mockResolvedValue({ status: 200, headers: new Headers(), body: null });
    (global as any).fetch = fetchMock;

    await client.dicomWebProxy('GET', 'studies', {});
    expect(fetchMock).toHaveBeenCalledWith(
      'http://orthanc:8042/dicom-web/studies',
      expect.anything(),
    );
  });
});
