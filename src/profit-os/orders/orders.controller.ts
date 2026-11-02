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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { DevTenantGuard } from '../../tenancy/guards/dev-tenant.guard';
import { CurrentWorkspace } from '../../tenancy/decorators/current-workspace.decorator';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(DevTenantGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiResponse({ status: 201, description: 'Order created' })
  @ApiResponse({ status: 200, description: 'Idempotent replay' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.create(workspaceId, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List orders with cursor pagination and filters' })
  @ApiResponse({ status: 200, description: 'Orders list' })
  async findMany(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.findMany(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.ordersService.findById(workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async update(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(workspaceId, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change order status' })
  @ApiResponse({ status: 200, description: 'Status changed' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  @ApiResponse({ status: 422, description: 'Illegal status transition' })
  async changeStatus(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.ordersService.changeStatus(workspaceId, id, dto);
  }

  @Post('bulk-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk status change (max 100 orders)' })
  @ApiResponse({ status: 200, description: 'Bulk operation completed with per-item results' })
  async bulkChangeStatus(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: BulkStatusDto,
  ) {
    return this.ordersService.bulkChangeStatus(workspaceId, dto);
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reopen refused order to delivered' })
  @ApiResponse({ status: 200, description: 'Order reopened' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 422, description: 'Cannot reopen this order' })
  async reopen(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
    @Body() body?: { changedBy?: string },
  ) {
    return this.ordersService.reopen(workspaceId, id, body?.changedBy);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete order' })
  @ApiResponse({ status: 204, description: 'Order deleted' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async softDelete(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.ordersService.softDelete(workspaceId, id);
  }
}
