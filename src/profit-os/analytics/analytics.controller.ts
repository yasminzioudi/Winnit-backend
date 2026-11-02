import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  DateRangeQueryDto,
  TimeseriesQueryDto,
} from './dto/query-analytics.dto';
import { DevTenantGuard } from '../../tenancy/guards/dev-tenant.guard';
import { CurrentWorkspace } from '../../tenancy/decorators/current-workspace.decorator';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor';
import type {
  AnalyticsSummaryResponse,
  TimeseriesResponse,
  ProductAnalyticsItem,
  CourierAnalyticsItem,
  GovernorateAnalyticsItem,
  CODAnalyticsResponse,
  WinnerRankingItem,
} from './dto/analytics-responses.dto';

@ApiTags('Analytics')
@ApiHeader({
  name: 'x-workspace-id',
  description: 'Tenant workspace ID',
  required: true,
})
@UseGuards(DevTenantGuard)
@UseInterceptors(EtagInterceptor)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get 30-day/custom period analytics summary and waterfall',
  })
  @ApiResponse({ status: 200, description: 'Aggregated financial summary' })
  @ApiResponse({ status: 304, description: 'Not Modified (ETag matched)' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async getSummary(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<AnalyticsSummaryResponse> {
    return this.analyticsService.getSummary(
      workspaceId,
      query.from,
      query.to,
      query.compare,
    );
  }

  @Get('waterfall')
  @ApiOperation({ summary: 'Alias for summary waterfall' })
  async getWaterfall(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<AnalyticsSummaryResponse> {
    return this.analyticsService.getSummary(
      workspaceId,
      query.from,
      query.to,
      query.compare,
    );
  }

  @Get('timeseries')
  @ApiOperation({ summary: 'Get timeseries financial data (daily or weekly)' })
  @ApiResponse({ status: 200, description: 'Timeseries data buckets' })
  @ApiResponse({ status: 304, description: 'Not Modified' })
  async getTimeseries(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: TimeseriesQueryDto,
  ): Promise<TimeseriesResponse> {
    return this.analyticsService.getTimeseries(
      workspaceId,
      query.from,
      query.to,
      query.granularity ?? 'daily',
    );
  }

  @Get('by-product')
  @ApiOperation({ summary: 'Get product financial performance aggregation' })
  @ApiResponse({ status: 200, description: 'Product performance list' })
  @ApiResponse({ status: 304, description: 'Not Modified' })
  async getByProduct(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<ProductAnalyticsItem[]> {
    return this.analyticsService.getByProduct(
      workspaceId,
      query.from,
      query.to,
    );
  }

  @Get('by-courier')
  @ApiOperation({ summary: 'Get courier COD performance breakdown' })
  @ApiResponse({ status: 200, description: 'Courier performance list' })
  @ApiResponse({ status: 304, description: 'Not Modified' })
  async getByCourier(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<CourierAnalyticsItem[]> {
    return this.analyticsService.getByCourier(
      workspaceId,
      query.from,
      query.to,
    );
  }

  @Get('couriers')
  @ApiOperation({ summary: 'Alias for by-courier' })
  async getCouriersAlias(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<CourierAnalyticsItem[]> {
    return this.analyticsService.getByCourier(
      workspaceId,
      query.from,
      query.to,
    );
  }

  @Get('by-governorate')
  @ApiOperation({ summary: 'Get geographic performance breakdown' })
  @ApiResponse({ status: 200, description: 'Governorate performance list' })
  @ApiResponse({ status: 304, description: 'Not Modified' })
  async getByGovernorate(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<GovernorateAnalyticsItem[]> {
    return this.analyticsService.getByGovernorate(
      workspaceId,
      query.from,
      query.to,
    );
  }

  @Get('geo')
  @ApiOperation({ summary: 'Alias for by-governorate' })
  async getGeoAlias(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<GovernorateAnalyticsItem[]> {
    return this.analyticsService.getByGovernorate(
      workspaceId,
      query.from,
      query.to,
    );
  }

  @Get('cod')
  @ApiOperation({ summary: 'Get COD reconciliation status and aging' })
  @ApiResponse({ status: 200, description: 'COD status and aging breakdown' })
  @ApiResponse({ status: 304, description: 'Not Modified' })
  async getCOD(
    @CurrentWorkspace() workspaceId: string,
  ): Promise<CODAnalyticsResponse> {
    return this.analyticsService.getCOD(workspaceId);
  }

  @Get('winners')
  @ApiOperation({ summary: 'Get winning products ranking and labels' })
  @ApiResponse({ status: 200, description: 'Winning products ranking list' })
  @ApiResponse({ status: 304, description: 'Not Modified' })
  async getWinners(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<WinnerRankingItem[]> {
    return this.analyticsService.getWinners(
      workspaceId,
      query.from,
      query.to,
    );
  }
}
