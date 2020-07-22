import { ObjectEntryOf, MaybePromise, ObjectKeyOf } from './types'

export function isObjectHasKey<M extends {}>(obj: M, key: string): key is string & keyof M {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

const MAX_LATER_DURATION = 3600000

export async function later(ms: number) {
  if (ms > MAX_LATER_DURATION) {
    const t0 = Date.now()
    const t1 = t0 + ms
    while (true) {
      const rest = Math.max(t1 - Date.now())
      if (rest > MAX_LATER_DURATION) {
        await later(MAX_LATER_DURATION)
      } else if (rest > 0) {
        await later(rest)
      } else {
        break
      }
    }
  } else {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
  }
}

export async function * interval(ms: number) {
  while (true) {
    await later(ms)
    yield
  }
}

export function cancellableLater(ms: number) {
  const { resolve, promise } = createExternalPromise<boolean>()
  let timer: NodeJS.Timeout | undefined = setTimeout(() => {
    timer = undefined
    resolve(true)
  }, ms)
  const cancel = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
    resolve(false)
  }
  return { cancel, promise }
}

export function keysOf<T extends {}>(x: T) {
  return Object.keys(x) as Array<ObjectKeyOf<T>>
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

export function call<T>(fn: () => T) {
  return fn()
}

export function createSequencePromise<T = void>() {
  let prev = Promise.resolve()
  let currentCount = 0
  return function then(cb: (index: number) => MaybePromise<T>) {
    const index = currentCount++
    const promise = prev.then(() => cb(index))
    prev = promise.then(noop, console.error)
    return promise
  }
}

export const noop = () => {}

export const identity = <T>(x: T) => x

export function dashToCamel(str: string) {
  const parts = str.split('-')
  const { length } = parts
  let s = parts[0]
  for (let i = 1; i < length; i++) {
    const a = parts[1]
    s += a[0].toLocaleUpperCase() + a.slice(1)
  }
  return s
}

export function once<T>(fn: () => T): () => T {
  let box: { readonly value: T } | undefined
  return () => box ? box.value : (box = { value: fn() }).value
}

export function matchAll(reg: RegExp, input: string) {
  if (reg.lastIndex !== 0) {
    throw new Error(`reg is not reset`)
  }
  const results: RegExpExecArray[] = []
  try {
    while (true) {
      const ret = reg.exec(input)
      if (!ret) break
      results.push(ret)
    }
    return results
  } finally {
    reg.lastIndex = 0
  }
}

export function stripUndefined<T>(x: T, deep = false): T {
  return stripValue(x, undefined, deep)
}

export function stripValue<T>(x: T, v: unknown, deep = false): T {
  if (typeof x === 'object' && x) {
    if (Array.isArray(x)) {
      if (!deep) return x
      return x.map((child: unknown) => stripValue(child, v, deep)) as unknown as T
    } else {
      const result = {} as T
      for (const key of Object.keys(x) as Array<keyof typeof x>) {
        const value = x[key]
        if (value === v) continue
        result[key] = deep ? stripValue(value, v, deep) : value
      }
      return result
    }
  }
  return x
}
