const stamp = (): string => new Date().toISOString().slice(11, 19)

export const log = {
  info: (message: string): void => console.log(`${stamp()} ${message}`),
  warn: (message: string): void => console.warn(`${stamp()} ! ${message}`),
}
