import { IsArray, IsIn, IsOptional } from 'class-validator';

/**
 * Global Import/Export payloads. The nested `sheets` / `modules` row objects are
 * read from the RAW request body in the controller (not these DTOs) so
 * custom-column keys and pending-parent markers survive the global whitelist
 * pipe — array/object element properties are not deep-validated here, and each
 * row is validated per-module against that module's own Create DTO in the
 * service. These classes only gate the envelope shape.
 */
export class GlobalImportDto {
  @IsOptional()
  @IsIn(['skip', 'update', 'create-new'])
  duplicateMode?: 'skip' | 'update' | 'create-new';
}

/** Records a Global Export the client performed (the file is generated client-side). */
export class ExportLogDto {
  @IsArray()
  modules!: { module: string; count: number }[];
}
