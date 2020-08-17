import { URL } from 'url'
import {
  failProviderMismatch,
  createProviderInfo,
} from '../common/typed-input'
import { call } from '../../utils/js'

const MATCH_INSTAGRAM_URL = (
  `^https?://(?:www\\.)?instagram\\.com/(?:${[
    `(?<account>[^/]+)`,
  ].join('|')})`
)

export type ParsedInstagramInfo = {
  account: string
}

export function parseUrl(url: URL) {
  const match = url.toString().match(MATCH_INSTAGRAM_URL)
  if (!match) return failProviderMismatch('instagram')

  const groups = match.groups || {}

  const data = call((): ParsedInstagramInfo => {
    return { account: groups.account }
  })

  return createProviderInfo('instagram', data)
}
