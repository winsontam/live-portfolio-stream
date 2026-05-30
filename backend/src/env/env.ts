import { IsNotEmpty, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class Env {
  @IsNotEmpty()
  REDIS_URL: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  PORT: number;

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = '*';
}
