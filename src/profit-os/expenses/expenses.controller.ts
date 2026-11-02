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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { DevTenantGuard } from '../../tenancy/guards/dev-tenant.guard';
import { CurrentWorkspace } from '../../tenancy/decorators/current-workspace.decorator';

@ApiTags('Expenses')
@Controller('expenses')
@UseGuards(DevTenantGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create an expense entry' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiResponse({ status: 201, description: 'Expense entry created' })
  @ApiResponse({ status: 200, description: 'Idempotent replay' })
  @ApiResponse({ status: 422, description: 'Idempotency key reused with different payload' })
  async create(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: CreateExpenseDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.expensesService.create(workspaceId, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List expense entries with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of expense entries' })
  async findMany(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: QueryExpensesDto,
  ) {
    return this.expensesService.findMany(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense entry by ID' })
  @ApiResponse({ status: 200, description: 'Expense entry found' })
  @ApiResponse({ status: 404, description: 'Expense entry not found' })
  async findOne(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.findById(workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update expense entry' })
  @ApiResponse({ status: 200, description: 'Expense entry updated' })
  @ApiResponse({ status: 404, description: 'Expense entry not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async update(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete expense entry' })
  @ApiResponse({ status: 204, description: 'Expense entry deleted' })
  @ApiResponse({ status: 404, description: 'Expense entry not found' })
  async softDelete(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.expensesService.softDelete(workspaceId, id);
  }
}
