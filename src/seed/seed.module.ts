import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [CatalogModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
