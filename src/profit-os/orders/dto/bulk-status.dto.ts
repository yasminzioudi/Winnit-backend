import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsString, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BulkStatusItem {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  orderId: string;

  @ApiProperty({ enum: ['pending', 'confirmed', 'shipped', 'delivered', 'refused', 'cancelled'] })
  @IsEnum(['pending', 'confirmed', 'shipped', 'delivered', 'refused', 'cancelled'])
  status: string;
}

export class BulkStatusDto {
  @ApiProperty({ type: [BulkStatusItem], maximum: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkStatusItem)
  items: BulkStatusItem[];

  @ApiProperty({ example: 'user_123', required: false })
  @IsString()
  changedBy?: string;
}
