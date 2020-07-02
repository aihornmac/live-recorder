export type MaybePromise<T> = T | Promise<T>

export type MaybePromiseLike<T> = T | PromiseLike<T>

export type ObjectKeyOf<T> = (
  T extends ReadonlyMap<infer K, infer _V> ? K :
  T extends ReadonlyArray<infer _U> ? string :
  T extends {} ? keyof T :
  never
)

export type ObjectEntryOf<T> = (
  T extends ReadonlyMap<infer K, infer V> ? [K, V] :
  T extends ReadonlyArray<infer U> ? [string, U] :
  T extends {} ? Exclude<{ -readonly [P in keyof T]: [P, T[P]] }[keyof T], undefined> :
  never
)
