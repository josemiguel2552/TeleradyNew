import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { UploadDocumentDto } from "../models/upload-document.dto";
import { UploadDocumentCommand } from "../commands/upload-document.command";
import { UploadDocumentResponse } from "../models/upload-document.entity";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { GetUploadedDocumentsQuery } from "../queries/get-uploaded-documents.query";
import { I18nService } from "../../../i18n/i18n.service";
import { Request } from 'express';
import { GetUploadedDocumentsResponse } from "../models/get-upload-document.entity";

@Controller({ path: 'documents', version: '1' })
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class ProfessionalDocumentController {

  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus, private readonly i18n: I18nService) { }

  @Post()
  @ApiOperation({ summary: "Upload document" })
  @ApiCreatedResponse({ type: UploadDocumentResponse })
  async uploadDocument(@Req() request: Request, @Body() data: UploadDocumentDto): Promise<UploadDocumentResponse> {
    this.i18n.setLang(request);
    const dataUser: any = request.user;
    return await this.commandBus.execute(new UploadDocumentCommand({ ...data, email: dataUser.email }));
  }

  @Get()
  @ApiOperation({ summary: 'Get uploaded documents' })
  @ApiCreatedResponse({ type: GetUploadedDocumentsResponse })
  async getUploadedDocuments(@Req() request: Request): Promise<GetUploadedDocumentsResponse> {
    this.i18n.setLang(request);
    const dataUser: any = request.user;
    return await this.queryBus.execute(new GetUploadedDocumentsQuery(dataUser.email));
  }
}
