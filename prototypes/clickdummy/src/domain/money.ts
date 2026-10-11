export const round2 = (n: number): number => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100
