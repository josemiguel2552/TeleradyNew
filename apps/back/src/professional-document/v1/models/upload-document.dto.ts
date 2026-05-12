import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";

export class UploadDocumentDto {
  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsString()
  fileBase64: string;

  @ApiProperty()
  @IsNumber()
  documentTypeId: number;
}

export class UploadDocument {
  fileName: string;
  fileBase64: string;
  documentTypeId: number;
  email: string;
}
