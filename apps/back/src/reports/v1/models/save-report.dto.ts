import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDateString, IsIn, IsNumber, IsString, IsUUID } from "class-validator";

export class SaveReportDto {
  @ApiProperty({
    description: 'ID del profesional que crea o edita el informe',
    example: '1b2e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  idProfessional: string;

  @ApiProperty({
    description: 'ID del estudio',
    example: 'study-abc-123',
  })
  @IsString()
  studyId: string;

  @ApiProperty({
    description: 'Descripción del estudio',
    example: 'TC de tórax sin contraste',
  })
  @IsString()
  studyDesc: string;

  @ApiProperty({
    description: 'ID del paciente',
    example: 'pat-123456',
  })
  @IsString()
  patId: string;

  @ApiProperty({
    description: 'Nombre del paciente',
    example: 'Juan Pérez',
  })
  @IsString()
  patName: string;

  @ApiProperty({
    description: 'Sexo del paciente (M = Masculino, F = Femenino, O = Otro)',
    example: 'M',
  })
  @IsString()
  @IsIn(['M', 'F', 'O'])
  sex: string;

  @ApiProperty({
    description: 'Fecha de nacimiento del paciente (formato ISO 8601)',
    example: '1985-04-23',
  })
  @IsDateString()
  patBirthdate: string;

  @ApiProperty({
    description: 'Modalidades del estudio (ej. ["CT", "MR"])',
    example: ['CT', 'MR'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  modalities: string[];

  @ApiProperty({
    description: 'Nombre de la institución donde se realizó el estudio',
    example: 'Hospital Universitario de Madrid',
  })
  @IsString()
  institution: string;

  @ApiProperty({
    description: 'Fuente del estudio (ej. PACS, RIS)',
    example: 'PACS',
  })
  @IsString()
  src: string;

  @ApiProperty({
    description: 'ID numérico del estado del informe',
    example: 1,
  })
  @IsNumber()
  idReportState: number;
}