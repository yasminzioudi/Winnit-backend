import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsInt,
} from 'class-validator';

export class CreateScenarioDto {
  @ApiProperty({ example: 'Optimistic Holiday Margin' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'prd_001' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 149000, description: 'Unit price in millimes' })
  @IsInt()
  @Min(0)
  unitPriceMillimes: number;

  @ApiProperty({ example: 28000, description: 'Unit COGS in millimes' })
  @IsInt()
  @Min(0)
  unitCogsMillimes: number;

  @ApiProperty({ example: 7000, description: 'Shipping cost in millimes' })
  @IsInt()
  @Min(0)
  shippingMillimes: number;

  @ApiProperty({ example: 25000, description: 'Target CPA in millimes' })
  @IsInt()
  @Min(0)
  adCpaMillimes: number;

  @ApiProperty({ example: 45.5, required: false })
  @IsNumber()
  @IsOptional()
  targetMarginPercent?: number;

  @ApiProperty({ example: 'Scenario test for Q4 pricing push', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

