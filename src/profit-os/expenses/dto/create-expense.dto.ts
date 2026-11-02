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

export class CreateExpenseDto {
  @ApiProperty({
    example: 'rent',
    enum: ['rent', 'salary', 'utilities', 'logistics', 'marketing', 'other'],
  })
  @IsIn(['rent', 'salary', 'utilities', 'logistics', 'marketing', 'other'])
  category: ExpenseCategory;

  @ApiProperty({ example: 'Bureau & Entrepôt Tunis' })
  @IsString()
  description: string;

  @ApiProperty({ example: 1200000, description: 'Amount in millimes' })
  @IsInt()
  @Min(0)
  amountMillimes: number;

  @ApiProperty({ example: 'monthly', enum: ['monthly', 'one-time'] })
  @IsIn(['monthly', 'one-time'])
  periodType: ExpensePeriod;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
