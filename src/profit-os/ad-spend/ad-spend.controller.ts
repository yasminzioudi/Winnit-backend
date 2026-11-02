import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AdSpendService } from './ad-spend.service';
import { CreateAdSpendDto } from './dto/create-ad-spend.dto';
import { UpdateAdSpendDto } from './dto/update-ad-spend.dto';
import { QueryAdSpendDto } from './dto/query-ad-spend.dto';
import { DevTenantGuard } from '../../tenancy/guards/dev-tenant.guard';
import { CurrentWorkspace } from '../../tenancy/decorators/current-workspace.decorator';

@ApiTags('Ad Spend')
@Controller('ad-spend')
@UseGuards(DevTenantGuard)
export class AdSpendController {
  constructor(private readonly adSpendService: AdSpendService) {}

  @Post()
  @ApiOperation({ summary: 'Create an ad spend entry' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiResponse({ status: 201, description: 'Ad spend entry created' })
  @ApiResponse({ status: 200, description: 'Idempotent replay' })
  @ApiResponse({ status: 422, description: 'Idempotency key reused with different payload' })
  async create(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: CreateAdSpendDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.adSpendService.create(workspaceId, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List ad spend entries with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of ad spend entries' })
  async findMany(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: QueryAdSpendDto,
  ) {
    return this.adSpendService.findMany(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ad spend entry by ID' })
  @ApiResponse({ status: 200, description: 'Ad spend entry found' })
  @ApiResponse({ status: 404, description: 'Ad spend entry not found' })
  async findOne(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.adSpendService.findById(workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ad spend entry' })
  @ApiResponse({ status: 200, description: 'Ad spend entry updated' })
  @ApiResponse({ status: 404, description: 'Ad spend entry not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async update(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAdSpendDto,
  ) {
    return this.adSpendService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete ad spend entry' })
  @ApiResponse({ status: 204, description: 'Ad spend entry deleted' })
  @ApiResponse({ status: 404, description: 'Ad spend entry not found' })
  async softDelete(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.adSpendService.softDelete(workspaceId, id);
  }
}

