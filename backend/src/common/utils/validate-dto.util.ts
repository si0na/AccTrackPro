import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

/**
 * Flattens a class-validator error tree into a flat list of human-readable
 * messages, recursing into nested validation errors.
 */
function collectMessages(errors: ValidationError[], out: string[] = []): string[] {
  for (const err of errors) {
    if (err.constraints) out.push(...Object.values(err.constraints));
    if (err.children?.length) collectMessages(err.children, out);
  }
  return out;
}

/**
 * Validate a plain object against a DTO class using the SAME rules the global
 * ValidationPipe applies to single-record create requests — so a bulk-imported
 * row is held to exactly the same field-level contract (required fields, enums,
 * formats, ranges, lengths) as a row created one at a time through the UI.
 *
 * `plainToInstance` runs the DTO's @Transform decorators (e.g. EmptyToUndefined)
 * before validation, mirroring the pipe. Implicit type conversion is disabled to
 * match the pipe's default, so numeric/boolean fields must already be the correct
 * JS type (the import layer coerces them before sending).
 *
 * Returns an array of error messages — empty when the row is valid.
 */
export async function validateDto<T extends object>(
  cls: ClassConstructor<T>,
  plain: Record<string, any>,
): Promise<string[]> {
  const instance = plainToInstance(cls, plain, { enableImplicitConversion: false });
  const errors = await validate(instance, {
    whitelist: false,
    forbidNonWhitelisted: false,
  });
  return collectMessages(errors);
}
