import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional, IsPhoneNumber, IsString, ValidateNested } from "class-validator";
import { OtherDocumentDto } from "./other-document.dto";

export class SaveProfessionalDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsString()
    lastName: string;

    @ApiProperty()
    @IsPhoneNumber()
    phone: string;

    @ApiProperty()
    @IsString()
    email: string;

    @ApiProperty()
    @IsString()
    cityResidence: string;

    @ApiProperty()
    @IsNumber()
    titleStatusId: number;

    @ApiProperty()
    @IsString()
    professionalLicense: string;

    @ApiProperty({type: Number, isArray:true})
    @IsArray()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    subspecialties: number[];

    @ApiPropertyOptional({ type: [OtherDocumentDto]})
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true})
    @Type(() => OtherDocumentDto)
    otherDocuments?: OtherDocumentDto[];
}