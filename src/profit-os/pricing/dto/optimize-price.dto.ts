import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OptimizePriceDto {
  @ApiPropertyOptional({ description: 'Optional product ID for reference' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({
    description: 'Current base selling price in integer millimes',
    example: 129000,
  })
  @IsInt()
  @Min(1000)
  basePriceMillimes: number;

  @ApiProperty({
    description: 'Unit COGS in integer millimes',
    example: 28000,
  })
  @IsInt()
  @Min(0)
  cogsMillimes: number;

  @ApiProperty({
    description: 'Unit logistics and courier costs in integer millimes',
    example: 14000,
  })
  @IsInt()
  @Min(0)
  logisticsMillimes: number;

  @ApiPropertyOptional({
    description: 'Current reference sales volume (units/month)',
    default: 100,
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  baseVolume?: number = 100;

  @ApiPropertyOptional({
    description: 'Demand price elasticity (negative float)',
    default: -1.5,
    example: -1.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(-10.0)
  @Max(-0.1)
  elasticity?: number = -1.5;

  @ApiPropertyOptional({
    description: 'Base refusal rate at current price (0.0 to 1.0)',
    default: 0.2,
    example: 0.2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  baseRefusalRate?: number = 0.2;

  @ApiPropertyOptional({
    description:
      'Refusal sensitivity: refusal rate increase per TND price increase',
    default: 0.002,
    example: 0.002,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.1)
  refusalSensitivity?: number = 0.002;

  @ApiPropertyOptional({
    description: 'Desired target margin percent (1..99)',
    example: 45.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(99)
  targetMarginPercent?: number;
}

export interface OptimizePriceResponse {
  basePriceMillimes: number;
  unitCostMillimes: number;
  recommendedBand: {
    minMillimes: number;
    maxMillimes: number;
    label: string;
  };
  elasticOptimumMillimes: number;
  breakEvenPriceMillimes: number;
  targetMarginPriceMillimes?: number;
  curve: Array<{
    priceMillimes: number;
    profitMillimes: number;
    refusalRate: number;
  }>;
  disclaimer: string;
}

