/**
 * Short, sortable, collision-safe-enough ids for a single-device database.
 * The time prefix keeps insertion order readable when inspecting the table.
 */
export function newId(prefix = 'i'): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${rand}`;
}
