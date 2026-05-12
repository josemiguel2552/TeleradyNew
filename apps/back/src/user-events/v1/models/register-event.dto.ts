import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, MaxLength } from 'class-validator';

export class RegisterEventDto {
  @ApiProperty({
    description: 'Tipo de evento (ej: report_start, report_view_img, report_finalize, etc.)',
    example: 'report_finalize',
  })
  @IsString()
  @MaxLength(100)
  eventType!: string;

  @ApiProperty({
    description: 'Payload del evento (estructura flexible y serializable)',
    example: { studyId: 'STUDY-001', durationMs: 1284 },
    type: Object,
  })
  @IsObject()
  eventPayload: any;
}
