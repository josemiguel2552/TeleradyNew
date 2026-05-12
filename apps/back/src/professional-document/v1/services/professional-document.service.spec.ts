import { Test, TestingModule } from '@nestjs/testing';
import { ProfessionalDocumentService } from './professional-document.service';

describe('ProfessionalDocumentService', () => {
  let service: ProfessionalDocumentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfessionalDocumentService],
    }).compile();

    service = module.get<ProfessionalDocumentService>(ProfessionalDocumentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
