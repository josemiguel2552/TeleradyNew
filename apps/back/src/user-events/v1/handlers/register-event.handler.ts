import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { RegisterEventCommand } from '../commands/register-event.command';
import { I18nService } from '../../../i18n/i18n.service';
import { EventLogRepository } from '../../../common/events/event-log.repository';
import { db } from '../../../database/drizzle';
import { Base } from '../../../common/models/Base.model';

@CommandHandler(RegisterEventCommand)
export class RegisterEventHandler implements ICommandHandler<RegisterEventCommand> {
  constructor(
    private readonly eventLogRepository: EventLogRepository,
    private readonly i18n: I18nService,
  ) {}

  async execute(command: RegisterEventCommand): Promise<Base> {
    try {
      const { data, actor } = command;
      if (!actor.professionalId) {
        throw new ForbiddenException('Only a registered professional can register an event');
      }
      return await db.transaction(async (tx) => {
        await this.eventLogRepository.saveEvent(tx, {
          idProfessional: actor.professionalId!,
          eventType: data.eventType,
          eventPayload: data.eventPayload,
        });
        return { ok: true, message: this.i18n.translate('userEvent.registerEvent.save') };
      });
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      console.error('RegisterEventHandler', err);
      throw new InternalServerErrorException(
        this.i18n.translate('userEvent.registerEvent.errorMessage'),
      );
    }
  }
}
