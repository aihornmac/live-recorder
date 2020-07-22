import { MaybePromiseLike, MaybePromise } from './types'
import { isErrorPayload } from './error'
import { cancellableLater } from './js'

export async function ensure<T>(request: () => MaybePromiseLike<T>): Promise<T> {
  while (true) {
    try {
      return await request()
    } catch (e) {
      if (isErrorPayload(e)) {
        if (e.code === 'string') {
          console.error(e.message)
        } else {
          console.error(e)
        }
        continue
      }
      throw e
    }
  }
}

export function ensureSync<T>(request: () => T): T {
  while (true) {
    try {
      return request()
    } catch (e) {
      if (isErrorPayload(e)) {
        if (e.code === 'string') {
          console.error(e.message)
        } else {
          console.error(e)
        }
        continue
      }
      throw e
    }
  }
}

export async function niceToHave<T>(
  request: () => MaybePromiseLike<T>,
  options?: {
    readonly silent?: boolean
  },
): Promise<T | undefined> {
  try {
    return await request()
  } catch (e) {
    if (!options?.silent) {
      console.error(e)
    }
    return
  }
}

export function niceToHaveSync<T>(
  request: () => T,
  options?: {
    readonly silent?: boolean
  },
): T | undefined {
  try {
    return request()
  } catch (e) {
    if (!options?.silent) {
      console.error(e)
    }
    return
  }
}

export interface UseBinaryExponentialBackoffAlgorithmOptions {
  /**
   * the first interval in ms
   * @default 1000
   */
  readonly startInterval?: number
  /**
   * max retry
   * @default 10
   */
  readonly maxRetry?: number
}

/**
 * use binary exponential backoff algorithm to request
 * @param request request function
 * @param options algorithm options
 */
export function useBinaryExponentialBackoffAlgorithm<T>(
  request: (duration: number) => T,
  options?: UseBinaryExponentialBackoffAlgorithmOptions
) {
  return new Promise<T>(async (_resolve, reject) => {
    const { maxRetry = 10, startInterval = 1000 } = options || {}

    let resolved = false

    const errors: unknown[] = []
    const runs: Array<Promise<unknown>> = []
    const laters = new Set<ReturnType<typeof cancellableLater>>()

    const resolve = (value: T) => {
      if (resolved) return
      resolved = true
      _resolve(value)
      for (const { cancel } of laters) {
        cancel()
      }
      laters.clear()
    }

    const run = async (interval: number) => {
      if (resolved) return
      const result = await runSafely(() => request(interval))
      if (result.state === 'resolved') {
        return resolve(result.result)
      } else {
        if (!errors.length) {
          errors.push(result.error)
        }
      }
    }

    runs.push(run(0))

    let accumulated = 0
    let interval = startInterval
    for (let i = 0; i < maxRetry; i++) {
      if (resolved) return
      const ret = cancellableLater(interval)
      laters.add(ret)
      await ret.promise
      if (resolved) return
      accumulated += interval
      runs.push(run(accumulated))
      if (i) interval *= 2
    }

    await Promise.all(runs)

    if (!resolved) {
      reject(errors[0])
    }
  })
}

export type SafeResult<T> = {
  state: 'resolved'
  result: T
} | {
  state: 'rejected'
  error: unknown
}

export async function runSafely<T>(fn: () => T | PromiseLike<T>): Promise<SafeResult<T>> {
  try {
    const result = await fn()
    return { state: 'resolved', result }
  } catch (e) {
    return { state: 'rejected', error: e as unknown }
  }
}

export async function exaustList<T>(
  limit: number,
  fn: (offset: number, limit: number) => MaybePromise<readonly T[]>,
): Promise<T[]> {
  const results: T[] = []
  let offset = 0
  while (true) {
    const list = await fn(offset, limit)
    results.push(...list)
    if (list.length < limit) break
    offset += limit
  }
  return results
}
