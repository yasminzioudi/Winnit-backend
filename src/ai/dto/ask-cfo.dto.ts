import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskCfoDto {
  @ApiProperty({
    description: 'Financial question to ask the Copilote CFO in natural French',
    example: 'Pourquoi mon net a baissé ce mois-ci ?',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  question: string;

  @ApiProperty({
    description: 'Start date of the financial scope (ISO 8601 or YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, {
    message: 'from must be a valid ISO 8601 date string (e.g. YYYY-MM-DD)',
  })
  from: string;

  @ApiProperty({
    description: 'End date of the financial scope (ISO 8601 or YYYY-MM-DD)',
    example: '2026-03-31',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, {
    message: 'to must be a valid ISO 8601 date string (e.g. YYYY-MM-DD)',
  })
  to: string;
}

export interface CfoFigure {
  label: string;
  value: number;
  unit: string;
  source: string;
  verified: boolean;
}

export interface AskCfoResponse {
  answer: string;
  citations: string[];
  figures: CfoFigure[];
  isVerified: boolean;
}

