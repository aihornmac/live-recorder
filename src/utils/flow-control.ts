import { MaybePromiseLike } from './types'
import { isErrorPayload } from './error'
import { later } from './js'

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

export async function niceToHave<T>(request: () => MaybePromiseLike<T>): Promise<T | void> {
  try {
    return await request()
  } catch (e) {
    console.error(e)
  }
}

export function niceToHaveSync<T>(request: () => T): T | void {
  try {
    return request()
  } catch (e) {
    console.error(e)
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

    const resolve = (value: T) => {
      resolved = true
      _resolve(value)
    }

    const errors: unknown[] = []

    const run = async (interval: number) => {
      if (resolved) return
      const result = await runSafely(() => request(interval))
      if (result.state === 'resolved') {
        if (!resolved) {
          return resolve(result.result)
        }
      } else {
        if (!errors.length) {
          errors.push(result.error)
        }
      }
    }

    run(0)

    let accumulated = 0
    let interval = startInterval
    for (let i = 0; i < maxRetry; i++) {
      if (resolved) return
      await later(interval)
      accumulated += interval
      run(accumulated)
      if (i) interval *= 2
    }

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
