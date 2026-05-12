import type { AuthenticatedUser } from '../../../auth/jwt.strategy';
import { SaveReportDto } from '../models/save-report.dto';

export class SaveReportCommand {
  constructor(
    public readonly data: SaveReportDto,
    public readonly actor: AuthenticatedUser,
  ) {}
}
