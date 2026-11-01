import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { MockProductCatalogAdapter } from './adapters/mock-product-catalog.adapter';
import { PRODUCT_CATALOG_PORT } from './ports/product-catalog.port';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    {
      provide: PRODUCT_CATALOG_PORT,
      useClass: MockProductCatalogAdapter,
    },
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
