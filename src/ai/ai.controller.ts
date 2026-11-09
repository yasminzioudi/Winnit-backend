import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { DevTenantGuard } from '../tenancy/guards/dev-tenant.guard';
import { AiService } from './ai.service';
import { AskCfoDto, type AskCfoResponse } from './dto/ask-cfo.dto';

@ApiTags('AI Copilot')
@ApiHeader({
  name: 'x-workspace-id',
  description: 'Tenant workspace ID',
  required: true,
})
@UseGuards(DevTenantGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ask questions to the CFO Copilot based on validated financial snapshots',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Financial analysis with citations and verified figures',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or prompt injection detected',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Exceeded rate limit of 10 requests per minute',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'AI model is unavailable or key not configured',
  })
  async ask(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: AskCfoDto,
  ): Promise<AskCfoResponse> {
    return this.aiService.askCfo(workspaceId, dto);
  }
}

