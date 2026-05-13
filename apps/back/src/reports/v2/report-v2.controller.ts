import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { AiDraftService } from './ai-draft.service';
import { AiDraftRequestDto, AiDraftResponseDto } from './dto/ai-draft.dto';
import { SaveReportV2Dto } from './dto/save-report-v2.dto';
import { SignReportDto } from './dto/sign-report.dto';
import { ReportResponseDto } from './dto/report-response.dto';
import { ReportV2Service } from './report-v2.service';

@ApiTags('reports-v2')
@Controller({ path: 'reports', version: '2' })
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Radiologist, Role.Coordinator, Role.Admin)
export class ReportV2Controller {
  constructor(
    private readonly service: ReportV2Service,
    private readonly aiDraftService: AiDraftService,
  ) {}

  @Get(':reportStudyId')
  @ApiOperation({ summary: 'Get the structured report (decrypted) for a study' })
  @ApiOkResponse({ type: ReportResponseDto })
  get(
    @Param('reportStudyId') reportStudyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    return this.service.get(reportStudyId, user);
  }

  @Put(':reportStudyId')
  @ApiOperation({ summary: 'Autosave the report draft (encrypted at rest)' })
  @ApiOkResponse({ type: ReportResponseDto })
  save(
    @Param('reportStudyId') reportStudyId: string,
    @Body() body: SaveReportV2Dto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    return this.service.saveDraft(reportStudyId, body.contents, user);
  }

  @Post(':reportStudyId/sign')
  @ApiOperation({ summary: 'Sign the report using the hospital policy' })
  @ApiOkResponse({ type: ReportResponseDto })
  sign(
    @Param('reportStudyId') reportStudyId: string,
    @Body() body: SignReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    return this.service.sign(reportStudyId, body, user);
  }

  @Post(':reportStudyId/send')
  @ApiOperation({ summary: 'Mark the report as sent to the hospital' })
  @ApiOkResponse({ type: ReportResponseDto })
  send(
    @Param('reportStudyId') reportStudyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    return this.service.send(reportStudyId, user);
  }

  @Post(':reportStudyId/ai-draft')
  @Roles(Role.Radiologist, Role.Admin)
  @ApiOperation({
    summary:
      'Generate an AI draft (RadiogenAI). Requires hospital opt-in and user consent.',
  })
  @ApiOkResponse({ type: AiDraftResponseDto })
  aiDraft(
    @Param('reportStudyId') reportStudyId: string,
    @Body() body: AiDraftRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiDraftResponseDto> {
    return this.aiDraftService.generate(reportStudyId, body, user);
  }

  /**
   * SSE counterpart of /ai-draft. Same precondition gate; the body is
   * streamed back as `data: …` lines so the editor paints the draft as
   * it arrives. The stream ends with an `event: done` frame; mid-stream
   * upstream failures land as `event: error` with a JSON payload.
   *
   * EventSource cannot send a body, so we keep this as POST and the
   * SPA consumes the response via fetch + ReadableStream. We do NOT
   * decorate this endpoint with `@Header` — that would commit
   * `text/event-stream` to 4xx responses too, confusing the SPA. We
   * write the SSE headers manually only once the precondition gate
   * passed (i.e. once we have a first chunk in hand).
   */
  @Post(':reportStudyId/ai-draft/stream')
  @Roles(Role.Radiologist, Role.Admin)
  @ApiOperation({
    summary:
      'Streaming AI draft (RadiogenAI). Same gate as /ai-draft; emits SSE chunks.',
  })
  @ApiProduces('text/event-stream')
  async aiDraftStream(
    @Param('reportStudyId') reportStudyId: string,
    @Body() body: AiDraftRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const generator = this.aiDraftService.generateStream(reportStudyId, body, user);

    // Pull the first chunk before flipping to SSE: if the gate or the
    // upstream rejects, the exception bubbles up and Nest turns it into
    // a normal 4xx/5xx JSON response.
    const first = await generator.next();
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const sendEvent = (event: string, data: string) => {
      const encoded = data.replace(/\r?\n/g, '\ndata: ');
      response.write(`event: ${event}\ndata: ${encoded}\n\n`);
    };

    try {
      if (!first.done) sendEvent('chunk', first.value.text);
      for await (const chunk of generator) {
        sendEvent('chunk', chunk.text);
      }
      sendEvent('done', '{}');
    } catch (err) {
      const status = (err as { status?: number })?.status ?? 500;
      const message = (err as Error)?.message ?? 'Unknown error';
      sendEvent('error', JSON.stringify({ status, message }));
    } finally {
      response.end();
    }
  }
}
