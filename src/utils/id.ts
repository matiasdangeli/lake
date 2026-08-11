/** Ids cortos y ordenables por tiempo, sin dependencias. */
export function createId(prefix = ''): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${prefix ? '_' : ''}${time}${rand}`;
}
