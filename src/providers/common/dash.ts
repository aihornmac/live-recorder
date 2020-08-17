import * as path from 'path'
import * as fs from 'fs'
import { URL } from 'url'
import { EventEmitter } from 'events'
import * as chalk from 'chalk'

import { TypedEventEmitter, TypedEventEmitterListener, MaybePromise } from '../../utils/types'
import { AbstractExecutor } from './executor'
import { PipeStream } from '../../utils/stream'
import { call, later, createMapMapper } from '../../utils/js'
import { niceToHave } from '../../utils/flow-control'
import { get, isAxiosError } from '../../utils/request'
import { parse, ManifestParser } from '../../utils/mpd'
import { isErrorPayload } from '../../utils/error'
import { pickStream } from './helpers'
import { once } from 'lodash'
import { exec } from '../../utils/cli'

export interface ManifestInput {
  readonly url: string
  readonly content: string
}

export type DashLoopItem = (
  | DashLoopMPD
  | DashLoopItemInit
  | DashLoopItemChunk
)

export interface DashLoopMPD {
  kind: 'mpd'
  content: string
}

export interface DashLoopItemCommon {
  representationId: string
  mimeType: string
  url: string
}

export interface DashLoopItemInit extends DashLoopItemCommon {
  kind: 'init'
}

export interface DashLoopItemChunk extends DashLoopItemCommon {
  kind: 'chunk'
  timepoint: number
  duration: number
  timescale: number
}

export function loopDashManifest(options: {
  readonly getManifest: ManifestInput | (() => MaybePromise<ManifestInput>)
  readonly interval?: number
}) {
  const { getManifest } = options

  const actions = new PipeStream<DashLoopItem>()

  let destroyed = false

  let { interval = 1000 } = options

  // representation id => timepoints
  const timepointMap = new Map<string, Set<number>>()
  const initMap = new Set<string>()

  // loop manifest
  call(async () => {
    while (true) {
      if (destroyed) return

      try {
        const manifestInput = typeof getManifest === 'function' ? await call(async () => {
          while (true) {
            try {
              return await getManifest()
            } catch (e) {
              if (isErrorPayload(e)) {
                if (e.code = 'network error') {
                  const { native } = e.data as { readonly native?: unknown }
                  if (isAxiosError(native)) {
                    if (native.response?.status === 404) {
                      await later(interval / 2)
                      continue
                    }
                  }
                }
              }
              console.error(e)
            }
          }
        }) : getManifest
        if (destroyed) return

        actions.write({
          kind: 'mpd',
          content: manifestInput.content,
        })

        const mpd = new ManifestParser().mpd(parse(manifestInput.content))

        const mpdUrl = new URL(mpd.baseUrl || '', manifestInput.url)
        for (const period of mpd.periods) {
          const periodUrl = new URL(period.baseUrl || '', mpdUrl.toString())
          for (const adaptationSet of period.adaptationSets) {
            const adaptationSetUrl = new URL(adaptationSet.baseUrl || '', periodUrl.toString())
            adaptationSet.representations.filter(x => x.bandwidth)
            const picked = pickStream(adaptationSet.representations.map(representation => {
              return {
                representation,
                data: {
                  BANDWIDTH: representation.bandwidth,
                  RESOLUTION: {
                    width: representation.width,
                    height: representation.height
                  },
                }
              }
            }))
            if (!picked) {
              console.log(chalk.yellowBright(`Representation not found in AdaptationSet ${period.__original.id}`))
              continue
            }
            const { representation } = picked
            const { segmentTemplate } = representation
            if (!segmentTemplate) {
              console.log(chalk.yellowBright(`SegmentTemplate is not present in Representation ${representation.__original.id}`))
              continue
            }
            const { segmentTimeline } = segmentTemplate
            if (!segmentTimeline) {
              console.log(chalk.yellowBright(`only SegmentTimeline is supported in Representation ${representation.__original.id}`))
              continue
            }
            const representationUrl = new URL(representation.baseUrl || '', adaptationSetUrl.toString())

            const { initialization, media, timescale } = segmentTemplate

            const mimeType = representation.mimeType || adaptationSet.mimeType || ''

            if (initialization) {
              if (!initMap.has(representation.id)) {
                initMap.add(representation.id)
                const initializationUrl = new URL(initialization, representationUrl.toString())
                actions.write({
                  kind: 'init',
                  representationId: representation.id,
                  mimeType,
                  url: initializationUrl.toString(),
                })
              }
            }

            const { segments } = segmentTimeline

            if (segments.length) {
              let timepoints = timepointMap.get(representation.id)
              if (!timepoints) timepointMap.set(representation.id, timepoints = new Set())

              let timepoint = 0
              for (const { t, d, r = 1 } of segments) {
                if (typeof t === 'number') {
                  timepoint = t
                }
                for (let k = 0; k < r; k++) {
                  if (timepoints.has(timepoint)) {
                    continue
                  }
                  timepoints.add(timepoint)
                  const segmentUri = media.replace(`$Time$`, String(timepoint))
                  const segmentUrl = new URL(segmentUri, representationUrl.toString())
                  actions.write({
                    kind: 'chunk',
                    representationId: representation.id,
                    mimeType,
                    url: segmentUrl.toString(),
                    timepoint,
                    duration: d,
                    timescale,
                  })
                  timepoint += d
                }
              }
              interval = Math.min(...segments.map(x => Math.floor(x.d / timescale * 1000)))
            }
          }
        }

        if (mpd.type === 'static') break

        await later(interval)
      } catch (e) {
        call(() => {
          if (isErrorPayload(e)) {
            if (e.code === 'string') {
              return console.error(e.message)
            }
          }
          console.error(e)
        })
        await later(1000)
      }
    }

    actions.end()
  })

  return {
    actions,
    dispose: () => { destroyed = true }
  }
}

export type DashContentType = 'merged' | 'chunks' | 'mpd'

export interface DashExecutorOptions {
  readonly url: string
  readonly manifest?: string | (() => MaybePromise<string>)
  readonly folderPath: string
  readonly concurrency: number
  readonly contents: ReadonlySet<DashContentType>
}

export type DashEventMap = {
  ['increase progress'](value: number, representationId: string): void
  ['increase total'](value: number, representationId: string): void
}

export interface DashEventEmitter extends Omit<EventEmitter, keyof TypedEventEmitter<DashEventMap>>, TypedEventEmitter<DashEventMap> {}

export class DashExecutor<TOptions extends DashExecutorOptions = DashExecutorOptions> extends AbstractExecutor {
  private _events = new EventEmitter() as DashEventEmitter
  private _downloads = new Map<string, Set<string>>()
  private _downloading = new Map<string, Promise<Buffer>>()

  constructor(readonly options: TOptions) {
    super()
  }

  get events(): TypedEventEmitterListener<DashEventMap> {
    return this._events
  }

  protected async _downloadBuffer(url: string) {
    const res = await get<Buffer>(url, { responseType: 'arraybuffer' })
    return res.data
  }

  protected async _sharedDownloadBuffer(url: string) {
    const downloading = this._downloading
    let existedPromise = downloading.get(url)
    if (existedPromise) return existedPromise
    existedPromise = call(async () => {
      while (true) {
        try {
          return await this._downloadBuffer(url)
        } catch (e) {
          if (isAxiosError(e)) {
            if (e.response?.status === 404) {
              await later(2000)
              continue
            }
          }
          console.error(e)
        }
      }
    }).finally(() => { downloading.delete(url) })
    downloading.set(url, existedPromise)
    return existedPromise
  }

  protected async _ensureDownload(url: string, filePath: string) {
    const downloads = this._downloads
    let localFiles = downloads.get(url)
    if (!localFiles) downloads.set(url, localFiles = new Set())
    if (localFiles.has(filePath)) return
    if (localFiles.size) {
      for (const localFilePath of localFiles) {
        try {
          await fs.promises.copyFile(localFilePath, filePath)
          localFiles.add(filePath)
          return
        } catch (e) {
          console.error(e)
        }
      }
    }
    const buffer = await this._sharedDownloadBuffer(url)
    await fs.promises.writeFile(filePath, buffer)
    localFiles.add(filePath)
    return buffer
  }

  protected async _execute() {
    const { folderPath, concurrency, contents, url: mpdUrl, manifest: inputManifestContent } = this.options

    const getManifest = (
      typeof inputManifestContent === 'string' ? { content: inputManifestContent, url: mpdUrl } :
      typeof inputManifestContent === 'function' ? async () => ({ content: await inputManifestContent(), url: mpdUrl }) :
      async () => {
        const res = await get<string>(mpdUrl, { responseType: 'text' })
        return { content: res.data, url: mpdUrl }
      }
    )

    const { actions } = loopDashManifest({
      getManifest,
    })

    const concurrent = new PipeStream<void>()
    for (let i = 0; i < concurrency; i++) {
      concurrent.write()
    }

    const mkdir = createMapMapper((inputPath: string) => fs.promises.mkdir(inputPath, { recursive: true }))

    const mpdFolderPath = path.join(folderPath, `mpds`)

    const mkdirMpdFolder = once(() => mkdir(mpdFolderPath))

    const promises: Promise<unknown>[] = []

    const getOrCreateWriteStream = call(() => {
      const map = new Map<string, fs.WriteStream>()
      const getOrCreate = (id: string, ext: string) => {
        let stream = map.get(id)
        if (!stream) {
          stream = fs.createWriteStream(path.join(folderPath, `${id}${ext}`))
          map.set(id, stream)
        }
        return stream
      }
      getOrCreate.map = map
      return getOrCreate
    })

    const streams = new Map<string, {
      readonly mimeType: string
      readonly fileName: string
    }>()

    for await (const action of actions) {
      if (action.kind === 'mpd') {
        if (contents.has('mpd')) {
          promises.push(
            niceToHave(async () => {
              await mkdirMpdFolder()
              await fs.promises.writeFile(path.join(mpdFolderPath, `${Date.now()}.mpd`), action.content)
            })
          )
        }
      } else if (action.kind === 'init') {
        const { pathname } = new URL(action.url)
        if (!streams.has(action.representationId)) {
          streams.set(action.representationId, {
            mimeType: action.mimeType,
            fileName: `${action.representationId}${path.extname(pathname)}`
          })
        }
        promises.push(
          niceToHave(async () => {
            const representationFolderPath = path.join(folderPath, action.representationId)
            await mkdir(representationFolderPath)
            const filePath = path.join(representationFolderPath, `init${path.extname(pathname)}`)
            const buffer = await this._ensureDownload(action.url, filePath)
            await niceToHave(async () => {
              if (contents.has('merged')) {
                const stream = getOrCreateWriteStream(action.representationId, path.extname(pathname))
                stream.write(buffer || await fs.promises.readFile(filePath))
              }
            })
          })
        )
      } else if (action.kind === 'chunk') {
        promises.push(
          niceToHave(async () => {
            this._events.emit('increase total', action.duration / action.timescale, action.representationId)
            const representationFolderPath = path.join(folderPath, action.representationId)
            await mkdir(representationFolderPath)
            const { pathname } = new URL(action.url)
            const filePath = path.join(representationFolderPath, `${action.timepoint}${path.extname(pathname)}`)
            const buffer = await this._ensureDownload(action.url, filePath)
            this._events.emit('increase progress', action.duration / action.timescale, action.representationId)
            await niceToHave(async () => {
              if (contents.has('merged')) {
                const stream = getOrCreateWriteStream(action.representationId, path.extname(pathname))
                stream.write(buffer || await fs.promises.readFile(filePath))
              }
            })
          })
        )
      }
    }

    await Promise.all(promises)

    if (contents.has('merged') && streams.size > 1) {
      const streamList = Array.from(streams)
      const video = streamList.find(([, data]) => data.mimeType.includes('video'))
      const audio = streamList.find(([, data]) => data.mimeType.includes('audio'))
      if (video && audio) {
        niceToHave(async () => {
          const cmd = `cd ${JSON.stringify(folderPath)} && ffmpeg -i ${JSON.stringify(video[1].fileName)} -i ${JSON.stringify(audio[1].fileName)} -map 0:v -map 1:a -c copy video.mp4`
          await exec(cmd)
        })
      }
    }
  }
}
