import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsInt,
} from 'class-validator';

export class UpdateScenarioDto {
  @ApiProperty({ example: 1, description: 'Current record version for optimistic locking' })
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({ example: 'Optimistic Holiday Margin', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'prd_001', required: false })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({ example: 159000, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  unitPriceMillimes?: number;

  @ApiProperty({ example: 28000, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  unitCogsMillimes?: number;

  @ApiProperty({ example: 7000, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  shippingMillimes?: number;

  @ApiProperty({ example: 25000, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  adCpaMillimes?: number;

  @ApiProperty({ example: 48.0, required: false })
  @IsNumber()
  @IsOptional()
  targetMarginPercent?: number;

  @ApiProperty({ example: 'Updated notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
