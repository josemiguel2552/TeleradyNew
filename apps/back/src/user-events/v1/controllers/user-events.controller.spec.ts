import { Test, TestingModule } from '@nestjs/testing';
import { UserEventsController } from './user-events.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { I18nService } from '../../../i18n/i18n.service';
import { RegisterEventDto } from '../models/register-event.dto';
import { RegisterEventCommand } from '../commands/register-event.command';
import { Request } from 'express';
import { Role } from '../../../auth/roles';
import type { AuthenticatedUser } from '../../../auth/jwt.strategy';

const radiologist: AuthenticatedUser = {
    id: 'u-1',
    email: 'r@x.es',
    roles: [Role.Radiologist],
    hospitalIds: ['h-1'],
    hospitalId: 'h-1',
    professionalId: '1b2e4567-e89b-12d3-a456-426614174000',
};

describe('UserEventsController', () => {
    let controller: UserEventsController;
    let commandBusMock: Partial<CommandBus>;
    let queryBusMock: Partial<QueryBus>;
    let i18nServiceMock: Partial<I18nService>;

    beforeEach(async () => {
        commandBusMock = {
            execute: jest.fn(),
        };

        queryBusMock = {
            execute: jest.fn(),
        };

        i18nServiceMock = {
            setLang: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserEventsController],
            providers: [
                { provide: CommandBus, useValue: commandBusMock },
                { provide: QueryBus, useValue: queryBusMock },
                { provide: I18nService, useValue: i18nServiceMock },
            ],
        }).compile();

        controller = module.get<UserEventsController>(UserEventsController);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('registerEvent', () => {
        it('should call commandBus.execute with RegisterEventCommand', async () => {
            const mockRequest = {
                headers: { 'accept-language': 'en' },
            } as Request;

            const mockData: RegisterEventDto = {
                eventType: "report_finalize",
                eventPayload: {
                    studyId: "STUDY-001",
                    timestamp: "2024-05-09T12:00:00Z",
                    durationMs: 1284
                }
            };

            const mockResponse = { ok: true, message: 'Event registered successfully' };
            (commandBusMock.execute as jest.Mock).mockResolvedValue(mockResponse);

            const result = await controller.registerEvent(mockRequest, mockData, radiologist);

            expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
            expect(commandBusMock.execute).toHaveBeenCalledWith(
                new RegisterEventCommand(mockData, radiologist),
            );
            expect(result).toEqual(mockResponse);
        });
    });

});
