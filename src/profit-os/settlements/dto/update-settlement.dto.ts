import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsArray,
  IsIn,
  IsInt,
  Min,
  IsOptional,
} from 'class-validator';
import type { CourierType, SettlementStatus } from '../schemas/settlement.schema';

export class UpdateSettlementDto {
  @ApiProperty({ example: 1, description: 'Current record version for optimistic locking' })
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({ example: 'aramex', enum: ['aramex', 'yalidine'], required: false })
  @IsIn(['aramex', 'yalidine'])
  @IsOptional()
  courier?: CourierType;

  @ApiProperty({ example: '2026-01-15T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  settlementDate?: string;

  @ApiProperty({ example: 450000, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  totalAmountMillimes?: number;

  @ApiProperty({ example: ['65f1234567890abcdef12345'], type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  orderIds?: string[];

  @ApiProperty({ example: 'settled', enum: ['pending', 'settled'], required: false })
  @IsIn(['pending', 'settled'])
  @IsOptional()
  status?: SettlementStatus;
}
