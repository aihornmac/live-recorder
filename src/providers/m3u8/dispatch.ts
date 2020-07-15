import * as path from 'path'
import { URL } from 'url'
import {
  failProviderMismatch,
  createProviderInfo,
} from '../common/typed-input'

export type ParsedM3U8Info = {
  url: URL
}

export function parseUrl(url: URL) {
  const ext = path.extname(url.pathname)
  if (ext !== '.m3u8') {
    return failProviderMismatch('m3u8')
  }
  const data: ParsedM3U8Info = { url }
  return createProviderInfo('m3u8', data)
}
