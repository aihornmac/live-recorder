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

export interface EventEmitterMapLike {
  readonly [K: string]: Function
}

export interface TypedEventEmitter<T extends EventEmitterMapLike> extends TypedEventEmitterListener<T>, TypedEventEmitterEmitter<T> {}

export interface TypedEventEmitterListener<T extends EventEmitterMapLike> {
  on<K extends keyof T>(name: K, fn: T[K]): this
  once<K extends keyof T>(name: K, fn: T[K]): this
  off<K extends keyof T>(name?: K, fn?: T[K]): this
}

export interface TypedEventEmitterEmitter<T extends EventEmitterMapLike> {
  emit<K extends keyof T>(name: K, ...args: Params<T[K]>): boolean
}

export type Params<T extends Function> = T extends (...args: infer A) => infer _R ? A : unknown[]
