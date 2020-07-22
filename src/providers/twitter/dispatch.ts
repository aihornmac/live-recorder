import { URL } from 'url'
import {
  failProviderMismatch,
  createProviderInfo,
} from '../common/typed-input'
import { call } from '../../utils/js'

const MATCH_TWITTER_URL = (
  `^https?://twitter\\.com/(?:${[
    `[^/]+/status/(?<id>[0-9]+)`,
  ].join('|')})`
)

export type ParsedTwitterInfo = {
  id: string
}

export function parseUrl(url: URL) {
  const match = url.toString().match(MATCH_TWITTER_URL)
  if (!match) return failProviderMismatch('twitter')

  const groups = match.groups || {}

  const data = call((): ParsedTwitterInfo => {
    return { id: groups.id }
  })

  return createProviderInfo('twitter', data)
}
