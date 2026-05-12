import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportRepository } from './report.repository';
import { reportStudyInTelerady } from '../../../database/schema';
import { SaveReportDto } from '../models/save-report.dto';
import { db, DBOrTx } from '../../../database/drizzle';
import { AesGcmService } from '../../../common/crypto/aes-gcm.service';
import { ColumnEncryptionService } from '../../../common/crypto/column-encryption.service';
import { PseudonymService } from '../../../common/crypto/pseudonym.service';

jest.mock('../../../database/drizzle', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  },
}));

const masterKey = Buffer.alloc(32, 5).toString('hex');
const pepper = Buffer.alloc(32, 9).toString('hex');
const aes = new AesGcmService({ getOrThrow: () => masterKey } as unknown as ConfigService);
const pseudonym = new PseudonymService({ getOrThrow: () => pepper } as unknown as ConfigService);
const enc = new ColumnEncryptionService(aes, pseudonym);

describe('ReportRepository', () => {
  let repository: ReportRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportRepository,
        { provide: ColumnEncryptionService, useValue: enc },
      ],
    }).compile();
    repository = module.get<ReportRepository>(ReportRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    expect(repository).toBeDefined();
  });

  describe('getReport', () => {
    it('returns the report with decrypted patient fields', async () => {
      const patId = 'PAT-001';
      const aad = 'report_study:prof-1';
      const row = {
        id: 'r-1',
        professionalId: 'prof-1',
        patId: null,
        patName: null,
        patBirthdate: null,
        patIdEnc: enc.encrypt(patId, aad),
        patIdHash: enc.lookupHash(patId),
        patNameEnc: enc.encrypt('María García', aad),
        patBirthdateEnc: enc.encrypt('1985-04-23', aad),
      };
      (db.execute as jest.Mock).mockResolvedValue([row]);

      const result = await repository.getReport(db as DBOrTx, 'prof-1', 's-1');

      expect(result?.patId).toBe(patId);
      expect(result?.patName).toBe('María García');
      expect(result?.patBirthdate).toBe('1985-04-23');
    });

    it('returns null if no report exists', async () => {
      (db.execute as jest.Mock).mockResolvedValue([]);
      const result = await repository.getReport(db as DBOrTx, '123', 's-1');
      expect(result).toBeNull();
    });
  });

  describe('insertReport', () => {
    it('persists encrypted fields and a lookup hash, never the plaintext columns', async () => {
      const data: SaveReportDto = {
        idProfessional: 'prof-1',
        studyId: 's-1',
        studyDesc: 'CT Brain',
        patId: 'PAT-001',
        patName: 'María García',
        sex: 'F',
        patBirthdate: '1985-04-23',
        modalities: ['CT'],
        institution: 'Hospital X',
        src: 'agent',
        idReportState: 1,
      };
      (db.execute as jest.Mock).mockResolvedValue(undefined);

      await repository.insertReport(db as DBOrTx, data);

      expect(db.insert).toHaveBeenCalledWith(reportStudyInTelerady);
      const values = (db.values as jest.Mock).mock.calls[0][0];
      expect(values.patId).toBeNull();
      expect(values.patName).toBeNull();
      expect(values.patBirthdate).toBeNull();
      expect(typeof values.patIdEnc).toBe('string');
      expect(values.patIdEnc.startsWith('gcm:v1:')).toBe(true);
      expect(values.patIdHash).toBe(enc.lookupHash('PAT-001'));
    });
  });

  describe('updateReport', () => {
    it('encrypts the fields on update too', async () => {
      const data: SaveReportDto = {
        idProfessional: 'prof-1',
        studyId: 's-1',
        studyDesc: 'CT Brain',
        patId: 'PAT-001',
        patName: 'María García',
        sex: 'F',
        patBirthdate: '1985-04-23',
        modalities: ['CT'],
        institution: 'Hospital X',
        src: 'agent',
        idReportState: 2,
      };
      (db.execute as jest.Mock).mockResolvedValue(undefined);

      await repository.updateReport(db as DBOrTx, data, 'r-1');

      expect(db.update).toHaveBeenCalledWith(reportStudyInTelerady);
      const set = (db.set as jest.Mock).mock.calls[0][0];
      expect(set.patIdEnc.startsWith('gcm:v1:')).toBe(true);
    });
  });
});
