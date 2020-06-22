import Axios, { AxiosError } from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { fail } from './error'

export async function get<T>(url: string, options?: AxiosRequestConfig) {
  try {
    return await Axios.get<T>(url, options)
  } catch (e) {
    if (isAxiosError(e)) {
      if (e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET') {
        throw fail(`${e.code} ${url}`)
      }
    }
    throw fail('network error', `trying to send request to ${url}`, { url, native: e })
  }
}

export async function post<T>(url: string, data?: unknown, options?: AxiosRequestConfig) {
  try {
    return await Axios.post<T>(url, data, options)
  } catch (e) {
    if (isAxiosError(e)) {
      if (e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET') {
        throw fail(`${e.code} ${url}`)
      }
    }
    throw fail('network error', `trying to send request to ${url}`, { url, native: e })
  }
}

function isAxiosError(x: unknown): x is AxiosError {
  return Boolean(typeof x === 'object' && x && (x as { isAxiosError?: unknown }).isAxiosError)
}
