export const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

export const without = <T extends { id: string }>(list: T[], id: string): T[] => list.filter((x) => x.id !== id)
