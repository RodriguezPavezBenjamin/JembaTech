import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class BuildQuantityDto {
  @IsString()
  @MaxLength(100)
  id!: string;

  @IsInt()
  @Min(1)
  @Max(8)
  quantity!: number;
}

export class BuildDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => BuildQuantityDto)
  memory?: BuildQuantityDto[];

  @IsInt()
  @Min(1)
  @Max(100000000)
  budget!: number;

  @IsIn(["oficina", "estudio", "gaming", "programacion", "edicion"])
  intendedUse!: string;

  @IsOptional() @IsString() @MaxLength(100) cpu?: string;
  @IsOptional() @IsString() @MaxLength(100) gpu?: string;
  @IsOptional() @IsString() @MaxLength(100) board?: string;
  @IsOptional() @IsString() @MaxLength(100) ram?: string;
  @IsOptional() @IsString() @MaxLength(100) cooler?: string;
  @IsOptional() @IsString() @MaxLength(100) case?: string;
  @IsOptional() @IsString() @MaxLength(100) psu?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => BuildQuantityDto)
  drives?: BuildQuantityDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => BuildQuantityDto)
  extras?: BuildQuantityDto[];
}

export class UpdateBuildDto extends BuildDraftDto {
  @IsDateString()
  expectedUpdatedAt!: string;
}
