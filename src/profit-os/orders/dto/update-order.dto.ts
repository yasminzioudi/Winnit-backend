import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateOrderDto {
  @ApiProperty({ example: 129000, description: 'Unit price in millimes', required: false })
  @IsNumber()
  @IsOptional()
  unitPriceMillimes?: number;

  @ApiProperty({ example: 7000, description: 'Shipping cost in millimes', required: false })
  @IsNumber()
  @IsOptional()
  shippingMillimes?: number;

  @ApiProperty({ example: 0, description: 'Return shipping cost in millimes', required: false })
  @IsNumber()
  @IsOptional()
  returnShippingMillimes?: number;

  @ApiProperty({ example: 22000, description: 'Ad CPA in millimes', required: false })
  @IsNumber()
  @IsOptional()
  adCpaMillimes?: number;

  @ApiProperty({ example: 1, description: 'Current version for optimistic locking', required: true })
  @IsNumber()
  @Min(1)
  version: number;
}
