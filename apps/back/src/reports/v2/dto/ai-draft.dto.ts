import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AiDraftRequestDto {
  @ApiProperty({ description: 'Plain-text findings the radiologist already wrote' })
  @IsString()
  @MaxLength(20_000)
  findings!: string;

  @ApiProperty({ example: 'TC torax sin contraste' })
  @IsString()
  @MaxLength(200)
  reportTitle!: string;

  @ApiProperty({ required: false, enum: ['es', 'en'] })
  @IsOptional()
  @IsIn(['es', 'en'])
  language?: 'es' | 'en';

  @ApiProperty({
    required: false,
    description:
      'Set true on the first call to record the consent timestamp on the user. Subsequent calls do not need it.',
  })
  @IsOptional()
  @IsBoolean()
  acceptConsent?: boolean;
}

export class AiDraftResponseDto {
  @ApiProperty({ description: 'Markdown / plain-text draft from the upstream' })
  text!: string;

  @ApiProperty()
  latencyMs!: number;

  @ApiProperty()
  charCount!: number;
}
