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
import { ScenariosService } from './scenarios.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { QueryScenariosDto } from './dto/query-scenarios.dto';
import { DevTenantGuard } from '../../tenancy/guards/dev-tenant.guard';
import { CurrentWorkspace } from '../../tenancy/decorators/current-workspace.decorator';

@ApiTags('Scenarios')
@Controller('scenarios')
@UseGuards(DevTenantGuard)
export class ScenariosController {
  constructor(private readonly scenariosService: ScenariosService) {}

  @Post()
  @ApiOperation({ summary: 'Create a saved pricing scenario' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiResponse({ status: 201, description: 'Scenario created' })
  @ApiResponse({ status: 200, description: 'Idempotent replay' })
  @ApiResponse({ status: 422, description: 'Idempotency key reused with different payload' })
  async create(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: CreateScenarioDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.scenariosService.create(workspaceId, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List saved pricing scenarios with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of scenarios' })
  async findMany(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: QueryScenariosDto,
  ) {
    return this.scenariosService.findMany(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scenario by ID' })
  @ApiResponse({ status: 200, description: 'Scenario found' })
  @ApiResponse({ status: 404, description: 'Scenario not found' })
  async findOne(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.scenariosService.findById(workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update scenario' })
  @ApiResponse({ status: 200, description: 'Scenario updated' })
  @ApiResponse({ status: 404, description: 'Scenario not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async update(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScenarioDto,
  ) {
    return this.scenariosService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete scenario' })
  @ApiResponse({ status: 204, description: 'Scenario deleted' })
  @ApiResponse({ status: 404, description: 'Scenario not found' })
  async softDelete(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.scenariosService.softDelete(workspaceId, id);
  }
}
