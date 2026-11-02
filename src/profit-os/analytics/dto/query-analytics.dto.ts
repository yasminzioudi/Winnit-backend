import { IsISO8601, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function getLast30DaysInTunisia(): { from: string; to: string } {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  return {
    from: thirtyDaysAgo.toISOString(),
    to: now.toISOString(),
  };
}

export class DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Start of period (ISO 8601 UTC string), defaults to 30 days ago', example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End of period (ISO 8601 UTC string), defaults to now', example: '2026-01-31T23:59:59Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Comparison period identifier' })
  @IsOptional()
  @IsString()
  compare?: string;

  get fromOrDefault(): string {
    return this.from || getLast30DaysInTunisia().from;
  }

  get toOrDefault(): string {
    return this.to || getLast30DaysInTunisia().to;
  }
}

export class TimeseriesQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({
    enum: ['daily', 'weekly', 'day', 'week', 'month'],
    default: 'daily',
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'day', 'week', 'month'])
  granularity?: 'daily' | 'weekly' | 'day' | 'week' | 'month' = 'daily';

  @ApiPropertyOptional({ description: 'Comma-separated metric names' })
  @IsOptional()
  @IsString()
  metrics?: string;
}

