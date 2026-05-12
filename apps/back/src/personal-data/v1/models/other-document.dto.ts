import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";

export class OtherDocumentDto{
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
