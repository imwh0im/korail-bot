export type Brand<Key extends string, value> = value & { __brand: Key }
