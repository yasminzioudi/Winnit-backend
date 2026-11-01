import { ProductDto } from '../dto/product.dto';

/**
 * INTEGRATION POINT: Product catalog port
 * Current: MockProductCatalogAdapter (read-only, 12 products)
 * Future: Adapter calling teammate's real product API
 */
export interface ProductCatalogPort {
  findAll(workspaceId: string): Promise<ProductDto[]>;
  findOne(workspaceId: string, productId: string): Promise<ProductDto | null>;
}

export const PRODUCT_CATALOG_PORT = Symbol('PRODUCT_CATALOG_PORT');
