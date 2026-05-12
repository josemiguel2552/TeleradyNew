import { Controller, Get } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor() { }

  @Get()
  @ApiOperation({ summary: 'API start message' })
  @ApiCreatedResponse({ schema: { type: 'string' } })
  getHello(): string {
    return 'Back-Telerady server is running';
  }
}
