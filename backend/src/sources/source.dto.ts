import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

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
}

export class CpuRecoveryDto {
  @ApiProperty({ default: 1, minimum: 1, maximum: 5 })
  @IsInt() @Min(1) @Max(5) limit = 1;
  @ApiProperty({ description: 'Confirmación de consulta puntual del piloto; no acredita licencia de reutilización' })
  @Equals(true) acknowledged!: boolean;
}
