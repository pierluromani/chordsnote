let counter = 0;

/** Collision-resistant enough for local, single-device data. */
export function uid(prefix = ''): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
