/**
 * Recover custom-column fields that the global ValidationPipe (whitelist:true)
 * strips from a typed DTO. The global pipe creates a new DTO instance from
 * req.body without mutating the original, so req.body still carries every
 * field sent by the frontend.
 *
 * The raw body is spread first so validated DTO fields always win for known
 * keys, while any key absent from the DTO (i.e. a custom-column value) is
 * preserved and routed into custom_data by the service's customData().
 *
 * Fields that must never come from the client (id, ownerId) are stripped.
 */
export function mergeWithCustomFields(
  dto: Record<string, any>,
  rawBody: Record<string, any>,
): Record<string, any> {
  const { ownerId: _o, id: _i, ...safeRaw } = rawBody;
  return { ...safeRaw, ...dto };
}
