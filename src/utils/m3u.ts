import { matchAll } from './js'

const propertyReg = /^"?([^"]+?)"?="?([^"]+?)"?$/
const propertyRegGlobal = new RegExp(propertyReg, 'g')

export class M3UReader {
  readonly actions: M3UAction[] = []

  private _index = 0
  private _ctx?: M3UActionTrack | M3UActionStream

  push(line: string) {
    const index = this._index++
    const ctx = this._ctx
    if (!line && !ctx) return

    this._ctx = undefined

    // match track
    if (line.startsWith('#EXTINF')) {
      this._ctx = {
        ...parseTrack(line),
        kind: 'track',
      }
      return
    }

    // match stream
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      this._ctx = {
        kind: 'stream',
        value: parseExtension(line).value,
        url: '',
      }
      return
    }

    // match extension
    if (line.startsWith('#EXT-X')) {
      const action: M3UActionExtension = {
        ...parseExtension(line),
        kind: 'extension',
      }
      this.actions.push(action)
      return action
    }

    // ignore file header
    if (line === '#EXTM3U') return

    if (ctx) {
      // match track or stream
      ctx.url = line
      this.actions.push(ctx)
      return ctx
    } else {
      // unknown action
      const action: M3UActionUnknown = { kind: 'unknown', line, index }
      this.actions.push(action)
      return action
    }
  }
}

function parseTrack(line: string): Omit<M3UActionTrack, 'kind'> {
  const matchTrackInfo = line.match(/^#EXTINF:((?:[0-9]*[.])?[0-9]+?)([^0-9].*?)?(?:,(.*?))?$/)
  if (!matchTrackInfo) {
    throw new Error(`Cannot parse extinf ${JSON.stringify(line)}`)
  }
  const propertiesString = matchTrackInfo[2]
  const matchProperties = propertiesString.match(propertyRegGlobal)
  const properties: { [key: string]: string } = {}
  if (matchProperties) {
    for (const str of matchProperties) {
      const matchProperty = str.trim().match(propertyReg)!
      const key = matchProperty[1]
      const value = matchProperty[2]
      properties[key] = value
    }
  }
  const title = matchTrackInfo[3]
  return {
    title,
    duration: +matchTrackInfo[1],
    url: '',
  }
}

function parseExtension(line: string): Omit<M3UActionExtension, 'kind'> {
  const matchKeyValue = line.match(/^#EXT-X-(.*?)(?::(.*?))?$/)
  if (!matchKeyValue) {
    throw new Error(`Cannot parse ext-x ${JSON.stringify(line)}`)
  }
  const key = matchKeyValue[1]
  const value: string | undefined = matchKeyValue[2]
  return { key, value }
}

export function parseProperties(input: string) {
  const properties = new Map<string, string>()
  for (const match of matchAll(/(?:"(?<k1>[^"]*?)"|(?<k2>[^"=, \s]+?))=(?:"(?<v1>[^"]*?)"|(?<v2>[^"=, \s]+?)),/g, input + ',', )) {
    const { groups } = match
    if (!groups) continue
    const key = groups.k1 ?? groups.k2
    const value = groups.v1 ?? groups.v2
    properties.set(key, value)
  }
  return properties
}

export type M3UAction = (
  | M3UActionTrack
  | M3UActionStream
  | M3UActionExtension
  | M3UActionUnknown
)

export interface M3UActionTrack {
  kind: 'track'
  title?: string
  duration: number
  url: string
}

export interface M3UActionStream {
  kind: 'stream'
  value: string
  url: string
}

export interface M3UActionExtension {
  kind: 'extension'
  key: string
  value: string
}

export interface M3UActionUnknown {
  kind: 'unknown'
  index: number
  line: string
}
