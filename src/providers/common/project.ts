import * as fs from 'fs'
import * as path from 'path'
import * as URL from 'url'
import * as chalk from 'chalk'
import { get } from '../../utils/request'
import { parseM3U, M3U } from '../../utils/m3u'
import { ensure, niceToHaveSync, niceToHave } from '../../utils/flow-control'
import { later, predicate, times } from '../../utils/js'
import { exec } from '../../utils/cli'
import { fail, isErrorPayload } from '../../utils/error'
import { Clicker } from '../../utils/clicker'

export interface HLSProjectOptions {
  readonly getHeuristicChunkUrl?: (id: number, url: string) => (id: number) => string
}

export class HLSProject {
  private _url: string
  private _root: string
  private _playListsPath: string
  private _chunksPath: string
  private _isStopped: boolean
  private _isStreamStarted: boolean

  private _chunkDownloadMap = new Map<number, ChunkDownload>()
  protected _logger: LogWriter
  private _getHeuristicChunkUrl?: (id: number) => string

  constructor(
    streamUrl: string,
    projectDirectoryPath: string,
    readonly options?: HLSProjectOptions
  ) {
    this._url = streamUrl
    this._root = projectDirectoryPath
    this._playListsPath = path.join(projectDirectoryPath, 'playlists')
    this._chunksPath = path.join(projectDirectoryPath, 'chunks')
    this._logger = new LogWriter(path.join(projectDirectoryPath, 'logs.log'))
    this._isStopped = false
    this._isStreamStarted = false
  }

  async handover() {
    const MAX_EXIT_COUNT = 2
    const clicker = new Clicker(300)
    const onSIGINT = () => {
      if (this._isStopped) {
        if (clicker.click() >= MAX_EXIT_COUNT) {
          process.exit(0)
        }
        console.log()
        console.log(`press ${MAX_EXIT_COUNT - clicker.count} more time to exit`)
      } else {
        this._isStopped = true
        console.log()
        console.log(`recording stopped, waiting for chunks downloads...`)
      }
    }
    process.on('SIGINT', onSIGINT)

    await this.init()

    const state = await this.loopPlayList()
    if (state === 'ended') {
      console.log(chalk.green(`Stream ended`))
    }

    // waiting for chunk downloads
    await Promise.all(Array.from(this._chunkDownloadMap.values()).map(x => x.result()))

    console.log(`merging chunks...`)

    await this.mergeStream()

    process.removeListener('SIGINT', onSIGINT)

    return state
  }

  async init() {
    await Promise.all([
      fs.promises.mkdir(this._root, { recursive: true }),
      fs.promises.mkdir(this._playListsPath, { recursive: true }),
      fs.promises.mkdir(this._chunksPath, { recursive: true }),
    ])
    // TODO: recover
  }

  async loopPlayList() {
    let ended = false
    const interval = 2000

    while (!ended) {
      if (this._isStopped) return 'stopped'

      const t0 = Date.now()

      const check = async () => {
        try {
          const ret = await this.requestPlayList()
          if (ret === 'ended') {
            ended = true
          }
          const dt = Date.now() - t0
          if (dt > interval * 2) {
            console.log(chalk.gray(`request play list timeout ${dt}`))
          }
        } catch (e) {
          console.error(e)
        }
      }
      check()

      const t1 = Date.now()
      const dt = t1 - t0
      if (dt < interval) {
        await later(interval - dt)
      }
    }

    return 'ended'
  }

  async requestPlayList() {
    if (this._isStopped) return 'stopped'

    const t0 = Date.now()
    const res = await ensure(async () => {
      const r = await get<string>(this._url, {
        responseType: 'text',
        validateStatus(status) {
          return status >= 200 && status < 300 || status === 404
        },
      })
      if (r.status === 404) {
        if (this._isStreamStarted) return
        throw fail(`Live is not started`)
      }
      this._isStreamStarted = true
      return r
    })
    if (!res) return 'ended'

    if (this._isStopped) return 'stopped'

    const raw = res.data
    const m3u = niceToHaveSync(() => parseM3U(raw))
    niceToHave(async () => {
      const json = JSON.stringify({ raw, parsed: m3u }, null, 2)
      await fs.promises.writeFile(path.join(this._playListsPath, `${t0}.json`), json)
    })
    if (m3u) {
      const { mediaSequence } = m3u.extension
      if (typeof mediaSequence === 'number') {
        // heuristic chunk probing
        niceToHave(() => {
          if (!this._getHeuristicChunkUrl) {
            if (m3u.tracks.length) {
              const creator = this.options?.getHeuristicChunkUrl
              if (creator) {
                const chunkUrl = URL.resolve(this._url, m3u.tracks[0].url)
                this._getHeuristicChunkUrl = creator(mediaSequence, chunkUrl)
                this.triggerHeuristicChunkDownload(mediaSequence)
              }
            }
          }
        })
        niceToHave(async () => {
          await Promise.all(m3u.tracks.map(async (track, i) => {
            const id = mediaSequence + i
            await this.downloadChunk(id, track.url, true)
          }))
        })
      }
    }

    return
  }

  async downloadChunk(id: number, url: string, confident: boolean) {
    const map = this._chunkDownloadMap
    if (map.has(id)) return
    const chunkUrl = URL.resolve(this._url, url)
    const download = new ChunkDownload(id, chunkUrl, this._chunksPath, confident)
    map.set(id, download)
    if (confident) {
      console.log(`downloading chunk [${id}] ${chunkUrl}`)
    }
    const result = await download.result()
    if (result.state === 'rejected') {
      if (confident) {
        console.error(chalk.redBright(`Failed to download chunk [${id}] ${chunkUrl}`))
        console.log(result.reason)
      }
    } else if (result.ok) {
      if (!confident) {
        console.log(chalk.whiteBright(`heuristic downloaded chunk [${id}] ${chunkUrl}`))
      }
    }
    return result
  }

  async mergeStream() {
    const [chunksFileMap] = await Promise.all([
      this.getChunksFileMap(),
    ])
    const ids = Array.from(chunksFileMap.keys())
    if (!ids.length) return
    const minId = Math.min(...ids)
    const maxId = Math.max(...ids)
    const missedIds: number[] = []
    const chunkNames: string[] = []
    for (let i = minId; i <= maxId; i++) {
      const chunkFileName = chunksFileMap.get(i)
      if (chunkFileName) {
        chunkNames.push(chunkFileName)
      } else {
        console.error(chalk.yellowBright(`Missing chunk ${i}`))
        missedIds.push(i)
      }
    }
    if (missedIds.length) {
      throw fail(`Failed to merge due to missing chunks`)
      // for (const missedId of missedIds) {
      //   if (!chunkDurationMap.has(missedId)) {
      //     throw fail(chalk.redBright(`Unable to determine duration of chunk ${missedId}`))
      //   }
      // }
      // const tmpPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), `live-recorder-`))
      // await Promise.all(missedIds.map(id => {
      //   const duration = chunkDurationMap.get(id)!
      //   const a = `ffmpeg -t ${duration} -f lavfi -i color=c=black:s=640x360 -c:v libx264 -tune stillimage -pix_fmt yuv420p ${id}.ts`
      // }))
    }
    const concat = `concat:${times(ids.length, i => chunksFileMap.get(minId + i)).join('|')}`
    const outputFilePath = path.join(path.resolve(process.cwd(), this._root), 'output.mp4')
    const cdCommand = `cd ${JSON.stringify(path.resolve(process.cwd(), this._chunksPath))}`
    const ffmpegCommand = `ffmpeg -i ${JSON.stringify(concat)} -c copy -bsf:a aac_adtstoasc -fflags +genpts ${JSON.stringify(outputFilePath)}`
    const command = `${cdCommand} && ${ffmpegCommand}`
    console.log()
    console.log(command)
    console.log()
    await exec(command)
  }

  async getChunksFileMap() {
    const filenames = await fs.promises.readdir(this._chunksPath)
    return new Map(filenames.map(filename => {
      const matchId = filename.match(/^([0-9]+)\.?/)
      if (!matchId) return
      return [+matchId[1], filename] as const
    }).filter(predicate))
  }

  async getChunkDurationMapFromPlayList() {
    const filenames = await fs.promises.readdir(this._playListsPath)
    const list = (
      await Promise.all(filenames.map(async filename => {
        return niceToHave(async () => {
          const filePath = path.join(this._playListsPath, filename)
          const buffer = await fs.promises.readFile(filePath)
          const json: PlayListFile = JSON.parse(buffer.toString('utf8'))
          return json.parsed
        })
      }))
    ).filter(predicate)
    const chunkDuration = new Map<number, number>()
    for (const item of list) {
      const { mediaSequence } = item.extension
      if (typeof mediaSequence !== 'number') continue
      let i = -1
      for (const track of item.tracks) {
        i++
        chunkDuration.set(mediaSequence + i, track.duration)
      }
    }
    return chunkDuration
  }

  triggerHeuristicChunkDownload(startId: number) {
    const getHeuristicChunkUrl = this._getHeuristicChunkUrl
    if (!getHeuristicChunkUrl) return
    const maxLength = 100
    const cursorId = Math.max(0, startId - maxLength)
    const length = startId - cursorId
    if (length <= 0) return
    return niceToHave(async () => {
      return Promise.all(times(length, async i => {
        const id = cursorId + i
        const url = getHeuristicChunkUrl(id)
        return this.downloadChunk(id, url, false)
      }))
    })
  }
}

interface PlayListFile {
  raw: string
  parsed?: M3U
}

type ChunkDownloadResult = {
  state: 'resolved'
  ok: boolean
} | {
  state: 'rejected'
  reason: unknown
}

class ChunkDownload {
  private _promise: Promise<ChunkDownloadResult>

  constructor(
    readonly id: number,
    readonly url: string,
    readonly chunksPath: string,
    readonly confident: boolean
  ) {
    this._promise = this._run()
  }

  result() {
    return this._promise
  }

  private async _run() {
    return new Promise<ChunkDownloadResult>(async _resolve => {
      let resolved = false
      const resolve = (value: ChunkDownloadResult) => {
        resolved = true
        _resolve(value)
      }

      const run = async (interval: number) => {
        if (resolved) return { state: 'resolved' as const, ok: false }
        if (interval > 4000) {
          if (this.confident) {
            console.log(chalk.gray(`chunk ${this.id} download timeout ${interval}`))
          }
        }
        const result = await this._download()
        if (!resolved && result.state === 'resolved') {
          resolve(result)
        }
        return result
      }

      const results = await Promise.all([
        run(0),
        later(2000).then(() => run(2000)),
        later(4000).then(() => run(4000)),
        later(8000).then(() => run(8000)),
        later(16000).then(() => run(16000)),
        later(32000).then(() => run(32000)),
        later(64000).then(() => run(64000)),
      ])

      if (!resolved) {
        resolve(results[0])
      }
    })
  }

  private async _download() {
    const { id, url, chunksPath } = this
    return new Promise<ChunkDownloadResult>(async resolve => {
      try {
        const ok = await ensure(async () => {
          const stream = await ensure(async () => {
            const res = await get<NodeJS.ReadableStream>(url, {
              validateStatus(status) {
                return status >= 200 && status < 300 || status >= 400
              },
              responseType: 'stream',
            })
            if (res.status >= 200 && res.status < 300) {
              return res.data
            }
            if (!this.confident && res.status === 404) return
            return fail(`Request chunk ${id} returns ${res.status}`)
          })
          if (!stream) return false
          if (isErrorPayload(stream)) throw stream
          const ext = path.extname(url).slice(1)
          const writeStream = fs.createWriteStream(path.join(chunksPath, `${id}${ext ? '.' + ext : ''}`))
          stream.pipe(writeStream)
          await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve)
            writeStream.on('error', reject)
          })
          return true
        })
        resolve({ state: 'resolved', ok })
      } catch (e) {
        resolve({ state: 'rejected', reason: e })
      }
    })
  }
}

class LogWriter {
  private _filePath: string
  private _writeStream?: NodeJS.WritableStream

  constructor(logFilePath: string) {
    this._filePath = logFilePath
  }

  get writeStream() {
    return this._writeStream || (this._writeStream = fs.createWriteStream(this._filePath, { flags: 'a+' }))
  }

  log(content: string) {
    return this.writeStream.write(content)
  }
}
