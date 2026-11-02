import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ChangeStatusDto {
  @ApiProperty({ enum: ['pending', 'confirmed', 'shipped', 'delivered', 'refused', 'cancelled'] })
  @IsEnum(['pending', 'confirmed', 'shipped', 'delivered', 'refused', 'cancelled'])
  status: string;

  @ApiProperty({ example: 1, description: 'Current version for optimistic locking' })
  @IsNumber()
  @Min(1)
  version: number;

  @ApiProperty({ example: 'user_123', required: false })
  @IsString()
  @IsOptional()
  changedBy?: string;
}
