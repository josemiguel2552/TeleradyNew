import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportRepository } from './report.repository';
import { reportStudyInTelerady } from '../../../database/schema';
import { SaveReportDto } from '../models/save-report.dto';
import { db, DBOrTx } from '../../../database/drizzle';
import { AesGcmService } from '../../../common/crypto/aes-gcm.service';
import { ColumnEncryptionService } from '../../../common/crypto/column-encryption.service';
import { PseudonymService } from '../../../common/crypto/pseudonym.service';
import { TenantScope } from '../../../common/tenant/tenant-scope';
import { Role } from '../../../auth/roles';
import type { AuthenticatedUser } from '../../../auth/jwt.strategy';

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

const radiologist: AuthenticatedUser = {
  id: 'u-1',
  email: 'r@x.es',
  roles: [Role.Radiologist],
  hospitalIds: ['h-1'],
  hospitalId: 'h-1',
  professionalId: 'prof-1',
};
const admin: AuthenticatedUser = {
  id: 'u-admin',
  email: 'admin@x.es',
  roles: [Role.Admin],
  hospitalIds: [],
};

const dto: SaveReportDto = {
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

describe('ReportRepository', () => {
  let repository: ReportRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportRepository, { provide: ColumnEncryptionService, useValue: enc }],
    }).compile();
    repository = module.get<ReportRepository>(ReportRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findForProfessionalAndStudy', () => {
    it('returns the report with decrypted patient fields', async () => {
      const aad = 'report_study:prof-1';
      (db.execute as jest.Mock).mockResolvedValue([
        {
          id: 'r-1',
          professionalId: 'prof-1',
          patId: null,
          patName: null,
          patBirthdate: null,
          patIdEnc: enc.encrypt('PAT-001', aad),
          patNameEnc: enc.encrypt('María García', aad),
          patBirthdateEnc: enc.encrypt('1985-04-23', aad),
          hospitalId: 'h-1',
        },
      ]);

      const result = await repository.findForProfessionalAndStudy(
        db as DBOrTx,
        TenantScope.for(radiologist),
        'prof-1',
        's-1',
      );

      expect(result?.patId).toBe('PAT-001');
      expect(result?.patName).toBe('María García');
      expect(result?.patBirthdate).toBe('1985-04-23');
    });

    it('returns null when there is no match', async () => {
      (db.execute as jest.Mock).mockResolvedValue([]);
      const result = await repository.findForProfessionalAndStudy(
        db as DBOrTx,
        TenantScope.for(radiologist),
        'prof-1',
        's-1',
      );
      expect(result).toBeNull();
    });
  });

  describe('insertReport', () => {
    it('persists encrypted fields, lookup hash and tenant id', async () => {
      (db.execute as jest.Mock).mockResolvedValue(undefined);

      await repository.insertReport(db as DBOrTx, dto, {
        professionalId: 'prof-1',
        hospitalId: 'h-1',
      });

      expect(db.insert).toHaveBeenCalledWith(reportStudyInTelerady);
      const values = (db.values as jest.Mock).mock.calls[0][0];
      expect(values.patId).toBeNull();
      expect(values.patName).toBeNull();
      expect(values.patBirthdate).toBeNull();
      expect(values.patIdEnc.startsWith('gcm:v1:')).toBe(true);
      expect(values.patIdHash).toBe(enc.lookupHash('PAT-001'));
      expect(values.hospitalId).toBe('h-1');
      expect(values.professionalId).toBe('prof-1');
    });

    it('accepts a null hospitalId for privileged actors', async () => {
      (db.execute as jest.Mock).mockResolvedValue(undefined);

      await repository.insertReport(db as DBOrTx, dto, {
        professionalId: 'prof-1',
        hospitalId: null,
      });

      const values = (db.values as jest.Mock).mock.calls[0][0];
      expect(values.hospitalId).toBeNull();
    });
  });

  describe('updateReport', () => {
    it('writes encrypted fields on update too', async () => {
      (db.execute as jest.Mock).mockResolvedValue(undefined);

      await repository.updateReport(db as DBOrTx, dto, 'r-1', {
        professionalId: 'prof-1',
        hospitalId: 'h-1',
      });

      expect(db.update).toHaveBeenCalledWith(reportStudyInTelerady);
      const set = (db.set as jest.Mock).mock.calls[0][0];
      expect(set.patIdEnc.startsWith('gcm:v1:')).toBe(true);
    });
  });
});
