import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsIn } from 'class-validator';
import { PagePaginationDto } from '../../../common/dto/pagination.dto';
import type { CourierType, SettlementStatus } from '../schemas/settlement.schema';

export class QuerySettlementsDto extends PagePaginationDto {
  @ApiProperty({ example: 'aramex', enum: ['aramex', 'yalidine'], required: false })
  @IsIn(['aramex', 'yalidine'])
  @IsOptional()
  courier?: CourierType;

  @ApiProperty({ example: 'pending', enum: ['pending', 'settled'], required: false })
  @IsIn(['pending', 'settled'])
  @IsOptional()
  status?: SettlementStatus;
}
