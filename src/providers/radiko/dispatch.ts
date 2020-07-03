import { URL } from 'url'
import {
  failProviderMismatch,
  failProviderInvalid,
  createProviderInfo,
} from '../common/typed-input'
import { call } from '../../utils/js'

const MATCH_RADIKO_URL = (
  `^https?://radiko.jp/#!/(?:${[
    `live/(?<liveStationId>[^/?]+)`,
    `ts/(?<stationIdByTime>[^/?]+)/(?<startTime>[^/?]+)`,
  ].join('|')})`
)

export type ParsedRadikoInfo = {
  type: 'live'
  id: string
} | {
  type: 'replay'
  id: string
  startTime: number
}

export function parseUrl(url: URL) {
  const match = url.toString().match(MATCH_RADIKO_URL)
  if (!match) return failProviderMismatch('radiko')

  const groups = match.groups || {}

  const data = call((): ParsedRadikoInfo => {
    if (typeof groups.liveStationId === 'string')  {
      return { type: 'live', id: groups.liveStationId }
    }
    if (typeof groups.stationIdByTime === 'string')  {
      return { type: 'replay', id: groups.stationIdByTime, startTime: +groups.startTime }
    }
    throw failProviderInvalid('radiko', `unknown type`)
  })

  return createProviderInfo('radiko', data)
}
