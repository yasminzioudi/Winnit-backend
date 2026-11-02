import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { InsightsService } from './insights.service';
import { DateRangeQueryDto } from '../analytics/dto/query-analytics.dto';
import { DevTenantGuard } from '../../tenancy/guards/dev-tenant.guard';
import { CurrentWorkspace } from '../../tenancy/decorators/current-workspace.decorator';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor';
import type { Insight } from '../domain/insights';

@ApiTags('Insights')
@ApiHeader({
  name: 'x-workspace-id',
  description: 'Tenant workspace ID',
  required: true,
})
@UseGuards(DevTenantGuard)
@UseInterceptors(EtagInterceptor)
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  @ApiOperation({ summary: 'Get rule-based financial insights' })
  @ApiResponse({ status: 200, description: 'List of actionable insights' })
  @ApiResponse({ status: 304, description: 'Not Modified' })
  async getInsights(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<Insight[]> {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 86400000).toISOString();
    const defaultTo = now.toISOString();

    const from = query.from || defaultFrom;
    const to = query.to || defaultTo;

    return this.insightsService.getInsights(workspaceId, from, to);
  }
}
