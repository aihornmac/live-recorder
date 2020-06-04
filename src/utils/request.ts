import Axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { fail } from './error'

export async function get<T>(url: string, options?: AxiosRequestConfig) {
  try {
    return await Axios.get<T>(url, options)
  } catch (e) {
    throw fail('network error', `trying to send request to ${url}`, { url, native: e })
  }
}
