
import { Test, TestingModule } from '@nestjs/testing';
import { UserEventsService } from './user-events.service';

describe('UserEventsService', () => {
    let service: UserEventsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UserEventsService],
        }).compile();

        service = module.get<UserEventsService>(UserEventsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
