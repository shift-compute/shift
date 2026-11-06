/** PostgreSQL `bigint` (signed int64). Night ids are stored in that column. */
const INT64_MAX = (1n << 63n) - 1n;

/**
 * A night id is a positive int64: `YYYYMMDD` for the nightly batch, or unix seconds for a manual run.
 * Anything else is not a night address (the page and the API answer 404).
 */
export function parseNightId(raw: string): bigint | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const id = BigInt(raw);
  if (id > INT64_MAX) return null;
  return id;
}
