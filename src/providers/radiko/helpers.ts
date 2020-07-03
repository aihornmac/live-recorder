import * as fxp from 'fast-xml-parser'
import { once } from '../../utils/js'
import { LocalStorage } from '../common/localstorage'

export const PROVIDER = 'radiko'

export interface Config {
  readonly login?: {
    readonly mail: string
    readonly cipher: string
  }
}

export const getLocalStorage = once(() => new LocalStorage<Config>(PROVIDER))

export function parseXML<T>(xml: string): T {
  return fxp.parse(xml, {
    ignoreAttributes: false,
  })
}
