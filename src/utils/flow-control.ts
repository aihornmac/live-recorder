import { MaybePromiseLike } from './types'
import { isErrorPayload } from './error'

export async function ensure<T>(request: () => MaybePromiseLike<T>): Promise<T> {
  while (true) {
    try {
      return await request()
    } catch (e) {
      if (isErrorPayload(e)) {
        console.error(e)
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
        console.error(e)
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
