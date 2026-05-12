import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UserEventsController } from './v1/controllers/user-events.controller';
import { UserEventsService } from './v1/services/user-events.service';
import { EventLogModule } from '../common/events/event-log.module';
import { RegisterEventHandler } from './v1/handlers/register-event.handler';

const CommandHandlers = [RegisterEventHandler];
const QueryHandlers = [];

@Module({
    imports: [CqrsModule, EventLogModule],
    controllers: [UserEventsController],
    providers: [UserEventsService, ...CommandHandlers, ...QueryHandlers]
})
export class UserEventsModule { }
