export function createId(): string {
  return (
    "blk_" +
    Math.random().toString(36).slice(2, 8) +
    "_" +
    Date.now().toString(36)
  );
}
