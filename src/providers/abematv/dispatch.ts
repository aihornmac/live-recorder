import {
  failProviderMismatch,
  failProviderInvalid,
  createProviderInfo,
} from '../common/typed-input'
import { call } from '../../utils/js'

const MATCH_ABEMATV_URL = (
  `^https://abema.tv/(?:${[
    `now-on-air/(?<onair>[^\?]+)`,
    `video/episode/(?<episode>[^\?]+)`,
    `channels/.+?/slots/(?<slot>[^\?]+)`,
  ].join('|')})`
)

export interface ParsedAbematvInfo {
  id: string
  type: AbematvSourceType
}

export type AbematvSourceType = (
  | 'onair'
  | 'episode'
  | 'slot'
)

export function parseUrl(url: string) {
  const match = url.match(MATCH_ABEMATV_URL)
  if (!match) return failProviderMismatch('abematv')

  const groups = match.groups || {}

  const data = call((): ParsedAbematvInfo => {
    if (typeof groups.onair === 'string')  {
      return { type: 'onair', id: groups.onair }
    }
    if (typeof groups.eposide === 'string')  {
      return { type: 'episode', id: groups.eposide }
    }
    if (typeof groups.slot === 'string')  {
      return { type: 'slot', id: groups.slot }
    }
    throw failProviderInvalid('abematv', `unknown type`)
  })

  return createProviderInfo('abematv', data)
}
