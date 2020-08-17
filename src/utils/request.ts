import Axios, { AxiosError } from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { fail } from './error'

export async function get<T>(url: string, options?: AxiosRequestConfig) {
  try {
    return await Axios.get<T>(url, options)
  } catch (e) {
    handleError(e, url)
  }
}

export async function post<T>(url: string, data?: unknown, options?: AxiosRequestConfig) {
  try {
    return await Axios.post<T>(url, data, options)
  } catch (e) {
    handleError(e, url)
  }
}

function handleError(e: unknown, url: string): never {
  if (isAxiosError(e)) {
    const { code } = e
    if (typeof code === 'string' && code.startsWith('E')) {
      const { message } = e
      const pos = message.indexOf('Error: ')
      const msg = pos >= 0 ? message.slice(pos) : message
      throw fail(`${code} ${url} ${msg}`)
    }
  }
  throw fail('network error', `trying to send request to ${url}`, { url, native: e })
}

export function isAxiosError(x: unknown): x is AxiosError {
  return Boolean(typeof x === 'object' && x && (x as { isAxiosError?: unknown }).isAxiosError)
}
