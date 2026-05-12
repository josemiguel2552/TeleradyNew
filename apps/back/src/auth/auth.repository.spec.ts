import { Test, TestingModule } from "@nestjs/testing";
import { AuthRepository } from "./auth.repository";
import { db } from "../database/drizzle";

jest.mock('../database/drizzle', () => ({
    db: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(),
    }
}));

describe('AuthRepository', () => {
    let repository: AuthRepository;

    beforeEach(async () => {

        const module: TestingModule = await Test.createTestingModule({
            providers: [AuthRepository],
        }).compile();

        repository = module.get<AuthRepository>(AuthRepository);
    });

    it('should be defined', () => {
        expect(repository).toBeDefined();
    });

    describe('getUserByIdEmail', () => {
        it('should return the user if found', async () => {
            const mockUser = { id: '123', email: 'test@example.com' };
            (db.execute as jest.Mock).mockResolvedValueOnce([mockUser]);

            const result = await repository.getUserByIdEmail(db, '123', 'test@example.com');

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toEqual(mockUser);
        });

        it('should return null if no user is found', async () => {
            (db.execute as jest.Mock).mockResolvedValueOnce([]);

            const result = await repository.getUserByIdEmail(db, '123', 'test@example.com');

            expect(db.select).toHaveBeenCalled();
            expect(db.execute).toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });
});