import { Injectable, Inject } from '@nestjs/common';
import type { ProductCatalogPort } from './ports/product-catalog.port';
import { PRODUCT_CATALOG_PORT } from './ports/product-catalog.port';
import { ProductDto } from './dto/product.dto';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(PRODUCT_CATALOG_PORT)
    private readonly catalog: ProductCatalogPort,
  ) {}

  async findAll(workspaceId: string): Promise<ProductDto[]> {
    return this.catalog.findAll(workspaceId);
  }

  async findOne(
    workspaceId: string,
    productId: string,
  ): Promise<ProductDto | null> {
    return this.catalog.findOne(workspaceId, productId);
  }
}
