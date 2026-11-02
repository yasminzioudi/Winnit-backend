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
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';
import { QuerySettlementsDto } from './dto/query-settlements.dto';
import { DevTenantGuard } from '../../tenancy/guards/dev-tenant.guard';
import { CurrentWorkspace } from '../../tenancy/decorators/current-workspace.decorator';

@ApiTags('Settlements')
@Controller('settlements')
@UseGuards(DevTenantGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a courier settlement' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiResponse({ status: 201, description: 'Settlement created' })
  @ApiResponse({ status: 200, description: 'Idempotent replay' })
  @ApiResponse({ status: 422, description: 'Idempotency key reused with different payload' })
  async create(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: CreateSettlementDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.settlementsService.create(workspaceId, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List settlements with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of settlements' })
  async findMany(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: QuerySettlementsDto,
  ) {
    return this.settlementsService.findMany(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get settlement by ID' })
  @ApiResponse({ status: 200, description: 'Settlement found' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  async findOne(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.settlementsService.findById(workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update settlement' })
  @ApiResponse({ status: 200, description: 'Settlement updated' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async update(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSettlementDto,
  ) {
    return this.settlementsService.update(workspaceId, id, dto);
  }

  @Post(':id/reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reconcile settlement and link delivered orders (idempotent & retry-safe)' })
  @ApiResponse({ status: 200, description: 'Settlement reconciled' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  async reconcile(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.settlementsService.reconcile(workspaceId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete settlement' })
  @ApiResponse({ status: 204, description: 'Settlement deleted' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  async softDelete(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.settlementsService.softDelete(workspaceId, id);
  }
}
