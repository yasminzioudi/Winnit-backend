import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsIn } from 'class-validator';
import { PagePaginationDto } from '../../../common/dto/pagination.dto';
import type { ExpenseCategory, ExpensePeriod } from '../schemas/expense.schema';

export class QueryExpensesDto extends PagePaginationDto {
  @ApiProperty({
    required: false,
    example: 'rent',
    enum: ['rent', 'salary', 'utilities', 'logistics', 'marketing', 'other'],
  })
  @IsOptional()
  @IsIn(['rent', 'salary', 'utilities', 'logistics', 'marketing', 'other'])
  category?: ExpenseCategory;

  @ApiProperty({
    required: false,
    example: 'monthly',
    enum: ['monthly', 'one-time'],
  })
  @IsOptional()
  @IsIn(['monthly', 'one-time'])
  periodType?: ExpensePeriod;

  @ApiProperty({ required: false, example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, example: '2026-01-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
