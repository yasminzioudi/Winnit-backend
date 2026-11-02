import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  Min,
  IsInt,
} from 'class-validator';

export class UpdateAdSpendDto {
  @ApiProperty({ example: 1, description: 'Current record version for optimistic locking' })
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({ example: 'facebook', required: false })
  @IsString()
  @IsOptional()
  platform?: string;

  @ApiProperty({ example: 'Winter Fragrance Promo 2026', required: false })
  @IsString()
  @IsOptional()
  campaignName?: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @ApiProperty({ example: '2026-01-07T23:59:59.000Z', required: false })
  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @ApiProperty({ example: 160000, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  spendMillimes?: number;

  @ApiProperty({ example: 'prd_001', required: false })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({ example: 'Updated notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
