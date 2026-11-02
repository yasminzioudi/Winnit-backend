import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';
import { PagePaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAdSpendDto extends PagePaginationDto {
  @ApiProperty({ required: false, example: 'facebook' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiProperty({ required: false, example: 'prd_001' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ required: false, example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, example: '2026-01-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
