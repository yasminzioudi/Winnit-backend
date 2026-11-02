import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  Min,
  IsInt,
} from 'class-validator';

export class CreateAdSpendDto {
  @ApiProperty({ example: 'facebook', description: 'Advertising platform' })
  @IsString()
  platform: string;

  @ApiProperty({ example: 'Winter Fragrance Promo 2026' })
  @IsString()
  campaignName: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2026-01-07T23:59:59.000Z' })
  @IsDateString()
  periodEnd: string;

  @ApiProperty({ example: 150000, description: 'Spend amount in millimes' })
  @IsInt()
  @Min(0)
  spendMillimes: number;

  @ApiProperty({ example: 'TND', required: false, default: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 'prd_001', required: false })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({ example: 'Targeting Tunis & Sousse', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
