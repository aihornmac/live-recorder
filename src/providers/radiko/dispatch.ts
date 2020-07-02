import { URL } from 'url'
import {
  failProviderMismatch,
  failProviderInvalid,
  createProviderInfo,
} from '../common/typed-input'
import { call } from '../../utils/js'

const MATCH_RADIKO_URL = (
  `^https?://radiko.jp/#!/(?:${[
    `ts/(?<stationIdByTime>[^/?]+)/(?<startTime>[^/?]+)`,
    `ts/(?<stationId>[^/?]+)`,
  ].join('|')})`
)

export type ParsedRadikoInfo = {
  type: 'station'
  id: string
  startTime?: number
}

export function parseUrl(url: URL) {
  const match = url.toString().match(MATCH_RADIKO_URL)
  if (!match) return failProviderMismatch('radiko')

  const groups = match.groups || {}

  const data = call((): ParsedRadikoInfo => {
    if (typeof groups.stationId === 'string')  {
      return { type: 'station', id: groups.stationId }
    }
    if (typeof groups.stationIdByTime === 'string')  {
      return { type: 'station', id: groups.stationIdByTime, startTime: +groups.startTime }
    }
    throw failProviderInvalid('radiko', `unknown type`)
  })

  return createProviderInfo('radiko', data)
}
