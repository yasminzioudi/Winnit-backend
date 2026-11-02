import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryOrdersDto {
  @ApiProperty({ required: false, example: 10, minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @ApiProperty({ required: false, example: 'eyJwbGFjZWRBdCI6IjIwMjQtMDEtMTVUMTA6MDA6MDBaIiwiaWQiOiI2NTdhIn0' })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiProperty({ required: false, enum: ['pending', 'confirmed', 'shipped', 'delivered', 'refused', 'cancelled'] })
  @IsEnum(['pending', 'confirmed', 'shipped', 'delivered', 'refused', 'cancelled'])
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false, example: 'Aramex' })
  @IsString()
  @IsOptional()
  courier?: string;

  @ApiProperty({ required: false, example: 'Tunis' })
  @IsString()
  @IsOptional()
  governorate?: string;

  @ApiProperty({ required: false, example: 'prod_001' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({ required: false, example: '2024-01-01T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiProperty({ required: false, example: '2024-01-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiProperty({ required: false, example: 'ORD-100' })
  @IsString()
  @IsOptional()
  search?: string;

  // Validation: reject keys starting with "$"
  constructor() {
    const keys = Object.keys(this);
    for (const key of keys) {
      if (key.startsWith('$')) {
        throw new Error(`Invalid query parameter: ${key}`);
      }
    }
  }
}
