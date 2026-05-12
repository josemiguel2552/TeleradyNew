import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AuditQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiProperty({ required: false, example: 'report.signed' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number;
}

export class AuditEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() ts!: string;
  @ApiProperty({ nullable: true }) actorId!: string | null;
  @ApiProperty({ nullable: true }) actorRole!: string | null;
  @ApiProperty({ nullable: true }) hospitalId!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() targetKind!: string;
  @ApiProperty({ nullable: true }) targetId!: string | null;
  @ApiProperty({ type: Object }) payload!: unknown;
  @ApiProperty({ nullable: true }) prevHash!: string | null;
  @ApiProperty() hash!: string;
}

export class AuditListDto {
  @ApiProperty({ type: [AuditEntryDto] }) entries!: AuditEntryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}

export class AuditVerifyResultDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty({ nullable: true }) firstInvalidId!: string | null;
  @ApiProperty() checkedRows!: number;
}
