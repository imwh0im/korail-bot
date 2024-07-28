type Brand<Key extends string, value> = value & { __brand: Key };

export type StationName = Brand<'stationName', string>;
