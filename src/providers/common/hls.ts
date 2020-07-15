import { URL } from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as chalk from 'chalk'
import * as crypto from 'crypto'
import { EventEmitter } from 'events'

import { PipeStream } from '../../utils/stream'
import { M3UReader, M3UAction, parseProperties } from '../../utils/m3u'
import { readlineFromBuffer } from '../../utils/readline'
import { call, later, ExternalPromise, createExternalPromise, createSequancePromise } from '../../utils/js'
import { ensure, niceToHave } from '../../utils/flow-control'
import { get } from '../../utils/request'
import { fail } from '../../utils/error'
import { MaybePromise, TypedEventEmitter, TypedEventEmitterListener } from '../../utils/types'
import { waitForWriteStreamFinish } from '../../utils/node-stream'
import { ProgressBar } from '../../utils/progress-bar'
import { stringifyDuration, formatDurationInSeconds } from './helpers'
import { Muxer } from '../../utils/mux'

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

export type StreamMediaType = (
  | 'AUDIO'
  | 'VIDEO'
  | 'SUBTITLES'
  | 'CLOSED-CAPTIONS'
)

export type StreamMedia = {
  type: StreamMediaType
  url: string
  groupId: string
  name: string
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
  data: { [key: string]: string }
}>>
export async function parseStreamList<M extends ParserMapLike = {}>(
  options: {
    readonly content: string
    readonly parser: M
  }
): Promise<Array<{
  url: string
  data: { [key: string]: string } & ParsedMapOf<M>
}>>
export async function parseStreamList<M extends ParserMapLike = {}>(
  options: {
    readonly content: string
    readonly parser?: M
  }
) {
  const { content, parser } = options

  const media: StreamMedia[] = []

  const streams: Array<{
    url: string
    audio?: string
    data: { [key: string]: unknown }
  }> = []

  const reader = new M3UReader()

  for await (const line of readlineFromBuffer(content)) {
    reader.push(line)
  }

  for (const action of reader.actions) {
    if (action.kind === 'extension') {
      if (action.key === 'MEDIA') {
        const map = parseProperties(action.value)
        media.push({
          type: map.get('TYPE') as StreamMediaType,
          url: map.get('URI') as string,
          groupId: map.get('GROUP-ID') as string,
          name: map.get('NAME') as string,
        })
      }
    } else if (action.kind === 'stream') {
      const map = parseProperties(action.value)
      const data: { [key: string]: unknown } = {}

      if (parser) {
        for (const [key, value] of map) {
          if (typeof parser[key] === 'function') {
            data[key] = parser[key](value)
          } else {
            data[key] = value
          }
        }
      }

      streams.push({
        url: action.url,
        data,
      })
    }
  }

  const audios = new Map(media.filter(x => x.type === 'AUDIO').map(x => [x.groupId, x]))

  for (const stream of streams) {
    const { data } = stream
    if (typeof data.AUDIO === 'string') {
      const audio = audios.get(data.AUDIO)
      if (audio) {
        data.AUDIO = audio.url
        continue
      }
    }
    delete data.AUDIO
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
      readonly width?: number
      readonly height?: number
    }
  }
}>(streams: readonly T[], criteria?: string): T | undefined {
  if (!streams.length) return

  if (!criteria) criteria = 'best'

  let defaultStream = streams[0]

  if (streams.every(stream => Number(stream.data.BANDWIDTH) > 0)) {
    // sort from highest bandwidth to lowest
    const sorted = streams.slice().sort((a, b) => b.data.BANDWIDTH! - a.data.BANDWIDTH!)
    if (criteria === 'best') return sorted[0]
    if (criteria === 'worst') return sorted[sorted.length - 1]
    defaultStream = sorted[0]
  }

  if (streams.every(stream => stream.data.RESOLUTION)) {
    const isAllHasWidth = streams.every(stream => {
      const value = stream.data.RESOLUTION!.width
      return typeof value === 'number' && value > 0
    })
    const isAllHasHeight = streams.every(stream => {
      const value = stream.data.RESOLUTION!.height
      return typeof value === 'number' && value > 0
    })
    if (isAllHasWidth || isAllHasHeight) {
      // sort from highest quality to lowest
      const sorted = streams.map(x => {
        const { width, height } = x.data.RESOLUTION!
        const quality = isAllHasWidth ? isAllHasHeight ? width! * height! : width! : height!
        return { original: x, quality }
      }).sort((a, b) => b.quality - a.quality)

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
          if (typeof width === 'number' && width >= start && width < end) return stream
        }
      }

      defaultStream = sorted[0].original
    }
  }

  return defaultStream
}

export function printStreamChoices<T extends {
  readonly url: string
  readonly data: {
    readonly BANDWIDTH?: number
    readonly RESOLUTION?: {
      readonly width?: number
      readonly height?: number
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
    call(() => {
      if (resolution && typeof resolution === 'object') {
        const { width, height } = resolution
        if (typeof width === 'number') {
          if (typeof height === 'number') {
            parts.push(`${width}x${height}`)
          } else {
            parts.push(`${width}`)
          }
          return
        } else if (typeof height === 'number') {
          parts.push(`${height}`)
          return
        }
      }
      if (bandwidth) {
        parts.push(`${bandwidth} bps`)
      }
    })
    if (used) {
      parts.push(`[used]`)
    }
    const msg = parts.join(' ')
    console.log(used ? chalk.white(msg) : chalk.gray(msg))
  }
}

export type HLSContentType = 'merged' | 'chunks' | 'm3u8'

export interface HLSExecutorOptions {
  readonly url: string,
  readonly filePath: string
  readonly concurrency: number
  readonly actions: AsyncIterable<SequencedM3UAction> | Iterable<SequencedM3UAction>
  readonly contents: ReadonlySet<'merged' | 'chunks' | 'm3u8'>
}

export type HLSEventMap = {
  ['increase progress'](value: number): void
  ['increase total'](value: number): void
}

export interface HLSEventEmitter extends Omit<EventEmitter, keyof TypedEventEmitter<HLSEventMap>>, TypedEventEmitter<HLSEventMap> {}

export class HLSExecutor<TOptions extends HLSExecutorOptions = HLSExecutorOptions> {
  private _xp = createExternalPromise<void>()
  private _executionPromise?: Promise<void>
  private _halt?: ExternalPromise<void> = createExternalPromise()
  private _events = new EventEmitter() as HLSEventEmitter

  constructor(readonly options: TOptions) {}

  get events(): TypedEventEmitterListener<HLSEventMap> {
    return this._events
  }

  start() {
    if (!this._halt) return
    this._halt.resolve()
    this._halt = undefined
    if (!this._executionPromise) {
      const { resolve, reject } = this._xp
      this._executionPromise = this._execute().then(resolve, reject)
    }
  }

  stop() {
    if (this._halt) return
    this._halt = createExternalPromise()
  }

  exaust() {
    return this._xp.promise
  }

  protected async _downloadLicense(uri: string) {
    const res = await get<Buffer>(uri, { responseType: 'arraybuffer' })
    return res.data
  }

  protected async _execute() {
    const { filePath, concurrency, actions, contents, url: playListUrl } = this.options

    let decoder = defaultDecoder

    const concurrent = new PipeStream<void>()
    for (let i = 0; i < concurrency; i++) {
      concurrent.write()
    }

    const filePathNoExt = filePath.slice(0, -path.extname(filePath).length)

    const chunksPath = `${filePathNoExt}.chunks`
    const mergeWriteStream = contents.has('merged') ? fs.createWriteStream(filePath) : undefined
    const m3u8WriteStream = contents.has('m3u8') ? fs.createWriteStream(filePathNoExt + '.m3u8.json') : undefined

    const muxer = new Muxer<{ duration: number }>()

    if (contents.has('chunks')) {
      await fs.promises.mkdir(chunksPath, { recursive: true })
    }

    const muxPromise = niceToHave(async () => {
      if (!mergeWriteStream) return
      for await (const { buffer, data } of muxer) {
        mergeWriteStream.write(buffer)
        this._events.emit('increase progress', data.duration)
      }
    })

    const writeSequence = createSequancePromise()

    for await (const action of actions) {
      if (m3u8WriteStream) {
        m3u8WriteStream.write(JSON.stringify(action))
        m3u8WriteStream.write('\n')
      }
      if (mergeWriteStream || contents.has('chunks')) {
        if (action.kind === 'extension') {
          if (action.key === 'KEY') {
            await concurrent.read()
            // change key
            const map = parseProperties(action.value)
            const method = map.get('METHOD')
            if (method === 'NONE') {
              decoder = defaultDecoder
            } else if (method === 'AES-128') {
              const uri = map.get('URI')
              if (!uri) throw new Error(`uri is empty`)
              const ivInput = map.get('IV')
              if (!ivInput) throw new Error(`iv is empty`)
              const ivString = parseIV(ivInput) || ''
              const iv = Buffer.from(ivString, 'hex')
              const cipher = await ensure(() => this._downloadLicense(uri))
              decoder = encoded => decodeAES128(encoded, cipher, iv)
            } else {
              throw new Error(`Unknown method ${method}, ${Array.from(map.entries()).map(([key, value]) => `${key}=${value}`).join(',')}`)
            }
            concurrent.write()
          }
        } else if (action.kind === 'track') {
          const u = new URL(action.url, playListUrl)
          const url = u.toString()

          const currentDecoder = decoder

          this._events.emit('increase total', action.duration)

          let bufferPromise = concurrent.read().then(async () => {
            try {
              return await ensure(async () => {
                const res = await get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
                const buf = Buffer.from(res.data)
                return currentDecoder(buf)
              })
            } finally {
              concurrent.write()
            }
          })

          writeSequence(async () => {
            const buffer = await bufferPromise
            if (contents.has('chunks')) {
              const ext = path.extname(u.pathname)
              await fs.promises.writeFile(path.join(chunksPath, `${action.programDateTime || action.mediaSequence}${ext}`), buffer)
            }
            if (mergeWriteStream) {
              muxer.write({ buffer, data: { duration: action.duration } })
            } else {
              this._events.emit('increase progress', action.duration)
            }
          })
        }
      } else {
        if (action.kind === 'track') {
          this._events.emit('increase total', action.duration)
          this._events.emit('increase progress', action.duration)
        }
      }
    }

    await writeSequence(() => {
      muxer.end()
    })

    await muxPromise

    await Promise.all([
      mergeWriteStream,
      m3u8WriteStream,
    ].map(writeStream =>
      writeStream && call(async () => {
        if (writeStream.writableFinished) {
          writeStream.end()
        } else {
          const promise = waitForWriteStreamFinish(writeStream)
          writeStream.end()
          return promise
        }
      })
    ))
  }
}

export function createHLSProgressBar() {
  return new ProgressBar({
    smooth: 100,
    freshRate: 1,
    formatValue: (value, _, type) => {
      if (type === 'value' || type === 'total') {
        return stringifyDuration(formatDurationInSeconds(Math.floor(+value)))
      }
      return value
    }
  })
}

function defaultDecoder(buffer: Buffer) {
  return buffer
}

function decodeAES128(buffer: Buffer, videoKey: Buffer, iv: crypto.BinaryLike) {
  const aes = crypto.createDecipheriv('aes-128-cbc', videoKey, iv)
  aes.setAutoPadding(false)
  return Buffer.concat([aes.update(buffer), aes.final()])
}

const MATCH_IV = /^0x((?:[a-zA-Z0-9]{2})+)$/

function parseIV(input: string) {
  const match = input.match(MATCH_IV)
  if (!match) return
  return match[1]
}
