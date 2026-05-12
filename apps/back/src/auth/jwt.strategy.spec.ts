import { Test, TestingModule } from "@nestjs/testing";
import { JwtStrategy } from "./jwt.strategy";
import { AuthRepository } from "./auth.repository";
import { db } from "../database/drizzle";
import { UnauthorizedException } from "@nestjs/common";

jest.mock("../database/drizzle", () => ({
    db: {},
}));

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;
    let authRepositoryMock: Partial<AuthRepository>;

    beforeEach(async () => {
        process.env.TOKEN_KEY = 'test-secret-key';

        authRepositoryMock = {
            getUserByIdEmail: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JwtStrategy,
                { provide: AuthRepository, useValue: authRepositoryMock },
            ],
        }).compile();

        strategy = module.get<JwtStrategy>(JwtStrategy);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        delete process.env.TOKEN_KEY;
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    it('should return the payload if the user is valid', async () => {
        const mockPayload = { idUser: 1, email: 'test@example.com' };
        (authRepositoryMock.getUserByIdEmail as jest.Mock).mockResolvedValueOnce({ id: 1, email: 'test@example.com' });

        const result = await strategy.validate(mockPayload);

        expect(authRepositoryMock.getUserByIdEmail).toHaveBeenCalledWith(db, mockPayload.idUser, mockPayload.email);
        expect(result).toEqual(mockPayload);
    });

    it('should throw UnauthorizedException if the user is not valid', async () => {
        const mockPayload = { idUser: 1, email: 'test@example.com' };
        (authRepositoryMock.getUserByIdEmail as jest.Mock).mockResolvedValueOnce(null);

        await expect(strategy.validate(mockPayload)).rejects.toThrow(UnauthorizedException);
        expect(authRepositoryMock.getUserByIdEmail).toHaveBeenCalledWith(db, mockPayload.idUser, mockPayload.email);
    });
});