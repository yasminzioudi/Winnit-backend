import { IsISO8601, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DateRangeQueryDto {
  @ApiProperty({ description: 'Start of period (ISO 8601 UTC string)', example: '2026-01-01T00:00:00Z' })
  @IsISO8601()
  from: string;

  @ApiProperty({ description: 'End of period (ISO 8601 UTC string)', example: '2026-01-31T23:59:59Z' })
  @IsISO8601()
  to: string;

  @ApiPropertyOptional({ description: 'Comparison period identifier' })
  @IsOptional()
  @IsString()
  compare?: string;
}

export class TimeseriesQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: ['daily', 'weekly'], default: 'daily' })
  @IsOptional()
  @IsIn(['daily', 'weekly'])
  granularity?: 'daily' | 'weekly' = 'daily';

  @ApiPropertyOptional({ description: 'Comma-separated metric names' })
  @IsOptional()
  @IsString()
  metrics?: string;
}

