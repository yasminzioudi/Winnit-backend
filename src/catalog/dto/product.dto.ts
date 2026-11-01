export class ProductDto {
  id: string;
  workspaceId: string;
  name: string;
  sku: string;
  category: string;
  imageUrl?: string;
  sellingPriceMillimes: number;
  cogsMillimes: number;
  logisticsCostPerOrderMillimes: number;
  returnShippingMillimes: number;
  targetCpaMillimes: number;
  expectedRefusalRate: number;
  monthlyVolumeTarget: number;
  courier: string;
  status: string;
}
