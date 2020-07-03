import * as chalk from 'chalk'

import { PipeStream } from '../../utils/stream'
import { M3UReader, M3UAction, parseProperties } from '../../utils/m3u'
import { readlineFromBuffer } from '../../utils/readline'
import { call, later } from '../../utils/js'
import { ensure } from '../../utils/flow-control'
import { get } from '../../utils/request'
import { fail } from '../../utils/error'
import { MaybePromise } from '../../utils/types'

export type SequencedM3UAction = M3UAction & {
  programDateTime: number
  mediaSequence: number
}

export function loopPlayList(options: {
  readonly getPlayList: string | (() => MaybePromise<string>)
  readonly interval: number
}) {
  const { getPlayList, interval } = options

  const m3uActions = new PipeStream<SequencedM3UAction>()

  let destroyed = false

  // loop playlist
  call(async () => {
    const reader = new M3UReader()

    let nextMediaSequence = 0
    let currentProgramDateTime = 0

    while (true) {
      if (destroyed) return

      const playlist = await ensure(async () => {
        if (typeof getPlayList === 'function') {
          return getPlayList()
        }
        const res = await get<string>(getPlayList, { responseType: 'text' })
        return res.data
      })

      let mediaSequence = 0
      let programDateTime = 0
      for await (const line of readlineFromBuffer(playlist)) {
        const action = reader.push(line)
        if (action) {
          if (action.kind === 'extension') {
            if (action.key == 'ENDLIST') {
              m3uActions.end()
              return
            }
            if (action.key === 'MEDIA-SEQUENCE') {
              mediaSequence = +action.value
            } else if (action.key === 'PROGRAM-DATE-TIME') {
              programDateTime = Date.parse(action.value)
            }
          }
          if (programDateTime) {
            // use program date time to determine sequence
            if (action.kind === 'track') {
              if (programDateTime > currentProgramDateTime) {
                currentProgramDateTime = programDateTime
                nextMediaSequence = mediaSequence + 1
                m3uActions.write({
                  ...action,
                  mediaSequence,
                  programDateTime,
                })
              }
              mediaSequence++
            } else {
              if (programDateTime >= currentProgramDateTime) {
                m3uActions.write({
                  ...action,
                  mediaSequence,
                  programDateTime,
                })
              }
            }
          } else {
            // use media sequence to determine sequence
            if (action.kind === 'track') {
              if (mediaSequence >= nextMediaSequence) {
                nextMediaSequence = mediaSequence + 1
                m3uActions.write({
                  ...action,
                  mediaSequence,
                  programDateTime,
                })
              }
              mediaSequence++
            } else {
              if (mediaSequence >= nextMediaSequence) {
                m3uActions.write({
                  ...action,
                  mediaSequence,
                  programDateTime,
                })
              }
            }
          }
        }
      }

      await later(interval)
    }
  })

  return {
    actions: m3uActions,
    dispose: () => { destroyed = true }
  }
}

type ParserMapLike = { readonly [key: string]: (value: string) => unknown }

type ParsedMapOf<M> = {
  -readonly [P in keyof M]: M[P] extends (value: string) => infer R ? R : never
}

export async function parseStreamList(
  options: {
    readonly content: string
  }
): Promise<Array<{
  url: string
  data: {}
}>>
export async function parseStreamList<M extends ParserMapLike = {}>(
  options: {
    readonly content: string
    readonly parser: M
  }
): Promise<Array<{
  url: string
  data: ParsedMapOf<M>
}>>
export async function parseStreamList<M extends ParserMapLike = {}>(
  options: {
    readonly content: string
    readonly parser?: M
  }
) {
  const { content, parser } = options

  const streams: Array<{
    url: string
    data: ParsedMapOf<M>
  }> = []

  const reader = new M3UReader()

  for await (const line of readlineFromBuffer(content)) {
    reader.push(line)
  }

  for (const action of reader.actions) {
    if (action.kind === 'stream') {
      const map = parseProperties(action.value)
      const data: { [key: string]: unknown } = {}

      if (parser) {
        for (const [key, value] of map) {
          if (typeof parser[key] === 'function') {
            data[key] = parser[key](value)
          }
        }
      }

      streams.push({
        url: action.url,
        data: data as ParsedMapOf<M>,
      })
    }
  }

  return streams
}

export function parseBandwidth(str: string) {
  const value = +String(str)
  if (!(Number.isFinite(value) && value > 0)) {
    throw fail(`Incorrect bandwidth ${str}`)
  }
  return value
}

export function parseResolution(str: string) {
  const match = str?.match(/^(?<width>[1-9][0-9]*?)x(?<height>[1-9][0-9]*?)$/)
  if (!match) {
    throw fail(`Incorrect bandwidth ${str}`)
  }
  return {
    width: +match.groups!.width,
    height: +match.groups!.height,
  }
}

export function pickStream<T extends {
  readonly url: string
  readonly data: {
    readonly BANDWIDTH?: number
    readonly RESOLUTION?: {
      readonly width: number
      readonly height: number
    }
  }
}>(streams: readonly T[], criteria?: string): T | undefined {
  if (!streams.length) return

  if (!criteria) criteria = 'best'

  if (streams.every(stream => Number(stream.data.BANDWIDTH) > 0)) {
    const sorted = streams.slice().sort((a, b) => b.data.BANDWIDTH! - a.data.BANDWIDTH!)
    if (criteria === 'best') return sorted[0]
    if (criteria === 'worst') return sorted[sorted.length - 1]
  }

  if (streams.every(stream => stream.data.RESOLUTION)) {
    const sorted = streams.map(x => {
      const resolution = x.data.RESOLUTION!
      const area = resolution.width * resolution.height
      return { original: x, area }
    }).sort((a, b) => b.area - a.area)
    if (criteria === 'best') return sorted[0].original
    if (criteria === 'worst') return sorted[sorted.length - 1].original

    // try to match format like 1080p
    const matchP = criteria.match(/^([0-9]+)p$/i)
    if (matchP) {
      const p = +matchP[1]
      for (const { original: stream } of sorted) {
        if (stream.data.RESOLUTION!.height === p) return stream
      }
    }

    // try to match format like 2k, 4k, 8k
    const matchK = criteria.match(/^([0-9]+)k$/i)
    if (matchK) {
      const k = +matchK[1]
      const start = k * 1000 - 500
      const end = k * 1000 + 500
      for (const { original: stream } of sorted) {
        const { width } = stream.data.RESOLUTION!
        if (width >= start && width < end) return stream
      }
    }
  }

  return streams[0]
}

export function printStreamChoices<T extends {
  readonly url: string
  readonly data: {
    readonly BANDWIDTH?: number
    readonly RESOLUTION?: {
      readonly width: number
      readonly height: number
    }
  }
}>(streams: readonly T[], picked: T) {
  if (!streams.length) {
    console.error(chalk.redBright(`No stream found`))
    return
  }

  console.log(`Found multiple streams:`)

  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i]
    const used = stream === picked
    const { BANDWIDTH: bandwidth, RESOLUTION: resolution } = stream.data
    const parts = [`[${i}]`]
    if (resolution) {
      parts.push(`${resolution.width}x${resolution.height}`)
    } else if (bandwidth) {
      parts.push(`${bandwidth} bps`)
    }
    if (used) {
      parts.push(`[used]`)
    }
    const msg = parts.join(' ')
    console.log(used ? chalk.white(msg) : chalk.gray(msg))
  }
}
