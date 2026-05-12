import type { AuthenticatedUser } from '../../../auth/jwt.strategy';
import { RegisterEventDto } from '../models/register-event.dto';

export class RegisterEventCommand {
  constructor(
    public readonly data: RegisterEventDto,
    public readonly actor: AuthenticatedUser,
  ) {}
}
