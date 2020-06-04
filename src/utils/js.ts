import { ObjectEntryOf } from './types'

export function isObjectHasKey<M extends {}>(obj: M, key: string): key is string & keyof M {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export function later(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function entriesOf<T>(x: T): Array<ObjectEntryOf<T>> {
  return Object.entries(x) as Array<ObjectEntryOf<T>>
}

export function predicate<T>(x: T): x is Exclude<T, null | undefined | void | false | 0 | ''> {
  return Boolean(x)
}

export function times<T>(n: number, map: (i: number) => T) {
  const arr: T[] = new Array(n)
  for (let i = 0; i < n; i++) {
    arr[i] = map(i)
  }
  return arr
}

export interface ExternalPromise<T = unknown> {
  promise: Promise<T>
  resolve(value: T | PromiseLike<T>): void
  reject(error: unknown): void
}

export function createExternalPromise<T>(): ExternalPromise<T> {
  type Type = ExternalPromise<T>
  let resolve!: Type['resolve']
  let reject!: Type['reject']
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { resolve, reject, promise }
}
