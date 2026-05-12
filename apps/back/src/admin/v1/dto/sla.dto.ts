import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SlaQueryDto {
  @ApiProperty({ required: false, description: 'Filter by hospital (admin/coordinator only)' })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}

export class SlaCountByStateDto {
  @ApiProperty() draft!: number;
  @ApiProperty() finalized!: number;
  @ApiProperty() signed!: number;
  @ApiProperty() sent!: number;
  @ApiProperty() unreported!: number;
}

export class SlaDashboardDto {
  @ApiProperty({ type: SlaCountByStateDto }) counts!: SlaCountByStateDto;
  @ApiProperty({ description: 'Average minutes from study creation to report signed' })
  avgMinutesToSign!: number | null;
  @ApiProperty({ description: 'Average minutes from signed to sent' })
  avgMinutesSignToSent!: number | null;
  @ApiProperty() pendingCount!: number;
  @ApiProperty() overSlaCount!: number;
  @ApiProperty({ description: 'SLA threshold in minutes used to compute overSla' })
  slaMinutes!: number;
}
