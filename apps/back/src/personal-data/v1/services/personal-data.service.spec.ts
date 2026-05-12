import { Test, TestingModule } from '@nestjs/testing';
import { PersonalDataService } from './personal-data.service';

describe('PersonalDataService', () => {
  let service: PersonalDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PersonalDataService],
    }).compile();

    service = module.get<PersonalDataService>(PersonalDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
