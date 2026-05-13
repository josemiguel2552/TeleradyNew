import { Controller, Get } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  @ApiOperation({ summary: 'API start message' })
  @ApiCreatedResponse({ schema: { type: 'string' } })
  getHello(): string {
    return 'Back-Telerady server is running';
  }

  /**
   * Liveness probe — answers as long as the event loop is up. Used
   * by the Docker HEALTHCHECK and Kubernetes liveness probes. Kept
   * outside the versioned `/v1` prefix so probes don't break when
   * the API version moves.
   */
  @Get('healthz')
  @ApiTags('infra')
  @ApiOperation({ summary: 'Liveness probe' })
  healthz(): { status: string } {
    return { status: 'ok' };
  }
}
