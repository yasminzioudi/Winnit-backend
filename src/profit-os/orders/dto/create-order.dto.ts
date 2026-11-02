import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsObject,
  ValidateNested,
  Min,
  IsOptional,
} from 'class-validator';

class CustomerInfoDto {
  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Tunis' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Tunis' })
  @IsString()
  governorate: string;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'prod_001' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 129000, description: 'Unit price in millimes' })
  @IsNumber()
  unitPriceMillimes: number;

  @ApiProperty({ example: 28000, description: 'Unit COGS in millimes' })
  @IsNumber()
  unitCogsMillimes: number;

  @ApiProperty({ example: 7000, description: 'Shipping cost in millimes' })
  @IsNumber()
  shippingMillimes: number;

  @ApiProperty({ example: 0, description: 'Return shipping cost in millimes', required: false })
  @IsNumber()
  @IsOptional()
  returnShippingMillimes?: number;

  @ApiProperty({ example: 0, description: 'Courier fee in millimes', required: false })
  @IsNumber()
  @IsOptional()
  courierFeeMillimes?: number;

  @ApiProperty({ example: 22000, description: 'Ad CPA in millimes' })
  @IsNumber()
  adCpaMillimes: number;

  @ApiProperty({ example: 'Aramex' })
  @IsString()
  courier: string;

  @ApiProperty({ type: CustomerInfoDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customer: CustomerInfoDto;

  @ApiProperty({ example: '2024-01-15T10:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  placedAt?: string;
}
