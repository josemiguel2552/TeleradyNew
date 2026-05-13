import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PushSubscriptionService } from './push-subscription.service';
import { TokenService } from './token.service';
import { environment } from '../../environments/environment';

describe('PushSubscriptionService', () => {
  let service: PushSubscriptionService;
  let httpMock: HttpTestingController;
  const tokenMock = { getRawToken: jest.fn().mockReturnValue('the-token') };
  const base = environment.apiTelerady.replace(/\/v1$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PushSubscriptionService,
        { provide: TokenService, useValue: tokenMock },
      ],
    });
    service = TestBed.inject(PushSubscriptionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    jest.clearAllMocks();
  });

  it('reports supported=false when the browser lacks ServiceWorker or PushManager', () => {
    // The Node test environment under jsdom doesn't ship a PushManager
    // — the constructor's feature detect should return false.
    expect(service.supported()).toBe(false);
  });

  it('enable() bails out gracefully when the browser is unsupported', async () => {
    const ok = await service.enable();
    expect(ok).toBe(false);
    httpMock.expectNone(`${base}/v1/push/public-key`);
  });

  describe('disable() with a server-side row', () => {
    it('DELETEs /v1/me/push/subscriptions/:id when a subscription is known', async () => {
      // Pretend enable() succeeded earlier by writing the signal.
      service.subscriptionId.set('sub-77');
      service.enabled.set(true);

      const promise = service.disable();
      const req = httpMock.expectOne(`${base}/v1/me/push/subscriptions/sub-77`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
      await promise;
      expect(service.enabled()).toBe(false);
      expect(service.subscriptionId()).toBeNull();
    });

    it('disable() with no known id is a no-op on the server', async () => {
      service.subscriptionId.set(null);
      await service.disable();
      httpMock.expectNone(`${base}/v1/me/push/subscriptions/null`);
      expect(service.enabled()).toBe(false);
    });
  });
});
