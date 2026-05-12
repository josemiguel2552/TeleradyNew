import { ApiProperty } from '@nestjs/swagger';

export class ReportResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() reportStudyId!: string;
  @ApiProperty({ enum: ['draft', 'finalized', 'signed', 'sent'] }) state!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ nullable: true }) hospitalId!: string | null;
  @ApiProperty() professionalId!: string;
  @ApiProperty({ type: Object, nullable: true }) contents!: unknown;
  @ApiProperty({ type: Object, nullable: true }) signature!: unknown;
  @ApiProperty({ nullable: true }) signedAt!: string | null;
  @ApiProperty({ nullable: true }) sentAt!: string | null;
  @ApiProperty({ nullable: true, description: 'Short-lived signed URL to the rendered PDF' })
  pdfUrl!: string | null;
}
