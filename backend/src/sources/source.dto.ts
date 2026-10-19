import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { SOURCE_CATEGORIES, SOURCE_TARGETS, SourceCategory } from './source.targets';
import { PRICE_TARGETS } from '../catalog/catalog.pricing';
import { CATALOG_TARGETS } from '../catalog/catalog.import';

export class CatalogRecoveryDto {
  @IsIn(CATALOG_TARGETS.map(target => target.id)) target!: string;
  @Equals(true) acknowledged!: boolean;
}

export class PriceRecoveryDto {
  @IsIn(PRICE_TARGETS.map(target => target.id)) target!: string;
  @Equals(true) acknowledged!: boolean;
}

export class CpuSampleDto {
  @ApiProperty({ description: "Fecha de recuperación declarada por el administrador, con zona horaria" })
  @IsDateString({ strict: true }) retrievedAt!: string;

  @ApiProperty({ description: "Hasta 5 fichas CPU originales; Python valida cada fila", type: [Object] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) records!: unknown[];
}

export class ReferenceQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 12;
  @IsOptional() @IsIn(SOURCE_CATEGORIES) category?: SourceCategory;
  @IsOptional() @IsString() @MaxLength(80) brand?: string;
}

export class ComponentSampleDto extends CpuSampleDto {
  @IsIn(SOURCE_CATEGORIES) category!: SourceCategory;
}

export class ComponentRecoveryDto {
  @IsIn(SOURCE_TARGETS.map(target => target.id)) target!: string;
  @Equals(true) acknowledged!: boolean;
}

export class CpuRecoveryDto {
  @ApiProperty({ default: 1, minimum: 1, maximum: 5 })
  @IsInt() @Min(1) @Max(5) limit = 1;
  @ApiProperty({ description: 'Confirmación de consulta puntual del piloto; no acredita licencia de reutilización' })
  @Equals(true) acknowledged!: boolean;
}
