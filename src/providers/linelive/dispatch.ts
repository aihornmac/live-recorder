import { URL } from 'url'
import {
  failProviderMismatch,
  createProviderInfo,
} from '../common/typed-input'
import { call } from '../../utils/js'

const MATCH_LINELIVE_URL = (
  `^https?://live\\.line\\.me/(?:${[
    `channels/(?<channel>[0-9]+)/broadcast/(?<broadcast>[0-9]+)`,
  ].join('|')})`
)

export type ParsedLineLiveInfo = {
  channelId: number
  broadcastId: number
}

export function parseUrl(url: URL) {
  const match = url.toString().match(MATCH_LINELIVE_URL)
  if (!match) return failProviderMismatch('linelive')

  const groups = match.groups || {}

  const data = call((): ParsedLineLiveInfo => {
    return { channelId: +groups.channel, broadcastId: +groups.broadcast }
  })

  return createProviderInfo('linelive', data)
}
