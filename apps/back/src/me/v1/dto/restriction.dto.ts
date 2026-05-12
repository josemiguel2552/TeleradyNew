import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ProcessingRestrictionDto {
  @ApiProperty({ description: 'Enable or disable processing restriction (RGPD art. 18)' })
  @IsBoolean()
  restricted!: boolean;
}
