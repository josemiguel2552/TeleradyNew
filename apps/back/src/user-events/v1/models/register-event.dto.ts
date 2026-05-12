import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsObject } from 'class-validator';

export class RegisterEventDto {
  @ApiProperty({
    description: 'ID del profesional que realiza la acción',
    example: '1b2e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  idProfessional: string;

  @ApiProperty({
    description: 'Tipo de evento realizado (ej: report_start, report_view_img, report_finalize, etc.)',
    example: 'report_finalize',
  })
  @IsString()
  eventType: string;

  @ApiProperty({
    description: 'Payload del evento (estructura flexible y serializable)',
    example: {
      studyId: 'STUDY-001',
      timestamp: '2024-05-09T12:00:00Z',
      durationMs: 1284,
    },
    type: Object,
  })
  @IsObject()
  eventPayload: any;
}
