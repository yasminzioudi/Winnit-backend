import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  Min,
  IsIn,
  IsInt,
} from 'class-validator';
import type { ExpenseCategory, ExpensePeriod } from '../schemas/expense.schema';

export class UpdateExpenseDto {
  @ApiProperty({ example: 1, description: 'Current record version for optimistic locking' })
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({
    example: 'rent',
    enum: ['rent', 'salary', 'utilities', 'logistics', 'marketing', 'other'],
    required: false,
  })
  @IsIn(['rent', 'salary', 'utilities', 'logistics', 'marketing', 'other'])
  @IsOptional()
  category?: ExpenseCategory;

  @ApiProperty({ example: 'Bureau & Entrepôt Tunis', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 1300000, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  amountMillimes?: number;

  @ApiProperty({ example: 'monthly', enum: ['monthly', 'one-time'], required: false })
  @IsIn(['monthly', 'one-time'])
  @IsOptional()
  periodType?: ExpensePeriod;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
