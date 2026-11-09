import { IsString, IsInt, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  @Min(1000)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  MONGODB_URI: string;

  @IsString()
  MONGODB_URI_TEST: string;

  @IsEnum(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsString()
  CORS_ORIGINS: string;

  @IsOptional()
  @IsEnum(['on', 'off'])
  SWAGGER?: 'on' | 'off';

  @IsString()
  DEV_WORKSPACE_ID: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  @IsOptional()
  @IsString()
  GEMINI_MODEL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Config validation error: ${messages}`);
  }

  return validatedConfig;
}
