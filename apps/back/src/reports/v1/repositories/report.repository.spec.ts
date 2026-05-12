import { Test, TestingModule } from '@nestjs/testing';
import { ReportRepository } from './report.repository';
import { reportStudyInTelerady } from '../../../database/schema';
import { SaveReportDto } from '../models/save-report.dto';
import { db, DBOrTx } from '../../../database/drizzle';

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
  }
}));

describe('ReportRepository', () => {
    let repository: ReportRepository;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ReportRepository],
        }).compile();

        repository = module.get<ReportRepository>(ReportRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(repository).toBeDefined();
    });

    describe('getReport', () => {
        it('should return a report if it exists', async () => {
            const mockReport = [{ id: 'report-123' }];
            (db.execute as jest.Mock).mockResolvedValue(mockReport);

            const result = await repository.getReport(db as DBOrTx, '123', 'study-abc');

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toEqual(mockReport[0]);
        });

        it('should return null if no report exists', async () => {
            (db.execute as jest.Mock).mockResolvedValue([]);

            const result = await repository.getReport(db as DBOrTx, '123', 'study-abc');

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });

    describe('insertReport', () => {
        it('should insert a new report into the database', async () => {
            const mockData: SaveReportDto = {
                idProfessional: '123',
                studyId: 'study-abc',
                studyDesc: 'Test Study',
                patId: 'pat-123',
                patName: 'John Doe',
                sex: 'M',
                patBirthdate: '1985-04-23',
                modalities: ['CT', 'MR'],
                institution: 'Test Hospital',
                src: 'PACS',
                idReportState: 1,
            };

            (db.execute as jest.Mock).mockResolvedValue(undefined);

            await repository.insertReport(db as DBOrTx, mockData);

            expect(db.insert).toHaveBeenCalledWith(reportStudyInTelerady);
            expect(db.execute).toHaveBeenCalled();
        });
    });

    describe('updateReport', () => {
        it('should update an existing report in the database', async () => {
            const mockData: SaveReportDto = {
                idProfessional: '123',
                studyId: 'study-abc',
                studyDesc: 'Updated Study',
                patId: 'pat-123',
                patName: 'John Doe',
                sex: 'M',
                patBirthdate: '1985-04-23',
                modalities: ['CT', 'MR'],
                institution: 'Updated Hospital',
                src: 'PACS',
                idReportState: 2,
            };

            const mockId = 'report-123';

            (db.execute as jest.Mock).mockResolvedValue(undefined);

            await repository.updateReport(db as DBOrTx, mockData, mockId);

            expect(db.update).toHaveBeenCalledWith(reportStudyInTelerady);
            expect(db.execute).toHaveBeenCalled();
        });
    });
});
