import { URL } from 'url'
import {
  failProviderMismatch,
  failProviderInvalid,
  createProviderInfo,
} from '../common/typed-input'
import { call } from '../../utils/js'

const MATCH_ABEMATV_URL = (
  `^https?://abema\\.tv/(?:${[
    `now-on-air/(?<onair>[^?]+)`,
    `video/title/(?<series>[^?]+)`,
    `video/episode/(?<episode>[^?]+)`,
    `channels/.+?/slots/(?<slot>[^?]+)`,
  ].join('|')})`
)

export type ParsedAbemaTVInfo = {
  type: 'onair' | 'episode' | 'slot'
  id: string
} | {
  type: 'series'
  id: string
  seasonId?: string
}

export function parseUrl(url: URL) {
  const match = url.toString().match(MATCH_ABEMATV_URL)
  if (!match) return failProviderMismatch('abematv')

  const groups = match.groups || {}

  const data = call((): ParsedAbemaTVInfo => {
    if (typeof groups.onair === 'string')  {
      return { type: 'onair', id: groups.onair }
    }
    if (typeof groups.series === 'string')  {
      const seasonId = url.searchParams.get('s') || undefined
      return { type: 'series', id: groups.series, seasonId }
    }
    if (typeof groups.episode === 'string')  {
      return { type: 'episode', id: groups.episode }
    }
    if (typeof groups.slot === 'string')  {
      return { type: 'slot', id: groups.slot }
    }
    throw failProviderInvalid('abematv', `unknown type`)
  })

  return createProviderInfo('abematv', data)
}
