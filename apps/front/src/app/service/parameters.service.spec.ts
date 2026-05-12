import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ParametersService } from './parameters.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('ParametersService', () => {
  let service: ParametersService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [ParametersService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(ParametersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
