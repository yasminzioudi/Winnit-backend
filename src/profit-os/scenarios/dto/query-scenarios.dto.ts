import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PagePaginationDto } from '../../../common/dto/pagination.dto';

export class QueryScenariosDto extends PagePaginationDto {
  @ApiProperty({ required: false, example: 'prd_001' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ required: false, example: 'Holiday' })
  @IsOptional()
  @IsString()
  search?: string;
}
