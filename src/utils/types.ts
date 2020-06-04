export type MaybePromise<T> = T | Promise<T>

export type MaybePromiseLike<T> = T | PromiseLike<T>

export type ObjectEntryOf<T> = (
  T extends ReadonlyMap<infer K, infer V> ? [K, V] :
  T extends ReadonlyArray<infer U> ? [string, U] :
  T extends {} ? Exclude<{ -readonly [P in keyof T]: [P, T[P]] }[keyof T], undefined> :
  never
)
