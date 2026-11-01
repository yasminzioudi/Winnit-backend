import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { DevTenantGuard } from '../tenancy/guards/dev-tenant.guard';
import { CurrentWorkspace } from '../tenancy/decorators/current-workspace.decorator';

@Controller('products')
@UseGuards(DevTenantGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async findAll(@CurrentWorkspace() workspaceId: string) {
    const products = await this.catalogService.findAll(workspaceId);
    return { data: products };
  }

  @Get(':id')
  async findOne(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') id: string,
  ) {
    const product = await this.catalogService.findOne(workspaceId, id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }
}
