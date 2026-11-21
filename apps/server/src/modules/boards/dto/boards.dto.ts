import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BOARD_TEMPLATES, type BoardTemplate } from '../templates';

export const BOARD_FILTERS = [
  'recent',
  'owned',
  'shared',
  'favorites',
  'archived',
] as const;

export type BoardFilter = (typeof BOARD_FILTERS)[number];

export class CreateBoardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsIn(BOARD_TEMPLATES)
  template?: BoardTemplate;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  folderName?: string;
}

export class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  folderName?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

export class BoardQueryDto {
  @IsOptional()
  @IsIn(BOARD_FILTERS)
  filter?: BoardFilter;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  folder?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  elementId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentId?: string;
}

export class ResolveCommentDto {
  @IsBoolean()
  resolved!: boolean;
}

export class CreateSnapshotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;
}
