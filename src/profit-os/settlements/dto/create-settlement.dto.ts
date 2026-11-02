import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsArray,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';
import type { CourierType } from '../schemas/settlement.schema';

export class CreateSettlementDto {
  @ApiProperty({ example: 'aramex', enum: ['aramex', 'yalidine'] })
  @IsIn(['aramex', 'yalidine'])
  courier: CourierType;

  @ApiProperty({ example: '2026-01-15T00:00:00.000Z' })
  @IsDateString()
  settlementDate: string;

  @ApiProperty({ example: 450000, description: 'Total settlement payout in millimes' })
  @IsInt()
  @Min(0)
  totalAmountMillimes: number;

  @ApiProperty({ example: ['65f1234567890abcdef12345'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderIds: string[];
}
