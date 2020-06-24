import * as path from 'path'
import * as fs from 'fs'
import * as yargs from 'yargs'
import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'
import { URL } from 'url'
import * as chalk from 'chalk'
import * as filenamify from 'filenamify'

import { CommonCreateOptions, CommonArgv } from '../common/typed-input'
import { M3UReader, parseProperties, M3UAction } from '../../utils/m3u'
import { readlineFromBuffer } from '../../utils/readline'
import { call, createSequancePromise, later } from '../../utils/js'
import {
  createUser,
  parseTicket,
  parseIV,
  getMediaToken,
  getHLSLicenseFromTicket,
  readEncodedVideoKey,
  getVideoKeyFromHLSLicense,
  getSlotChaseStreamListUrl,
  getSlotVodStreamListUrl,
  getSlotInfo,
  getVideoProgramInfo,
  getAnyPlaylist,
  getVideoSeriesInfo,
  getVideoSeriesProgramsInfo,
  getChannelList,
} from './api'
import { PipeStream } from '../../utils/stream'
import { ensure, exaustList } from '../../utils/flow-control'
import { get } from '../../utils/request'
import { parseUrl } from './dispatch'
import { fail } from '../../utils/error'
import { ProgressBar } from '../../utils/progress-bar'
import { formatDurationInSeconds, stringifyDuration } from '../common/helpers'

const DEFAULT_CONCURRENT = 8

export function match(url: URL) {
  const info = parseUrl(url)
  if (info.kind === 'error') return info

  return (yargs: yargs.Argv<CommonArgv>) => {
    const argv = (
      yargs
        .option('concurrent', {
          type: 'number',
          nargs: 1,
          demandOption: false,
          describe: `Specify concurrent chunk downlods, defaults to ${DEFAULT_CONCURRENT}`,
        })
        .option('token', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: 'Specify download token, defaults to anonymous user',
        })
        .option('eventType', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: `Specify event type, could be 'vod' or 'chase', defaults to vod if ended, chase if not`,
        })
        .option('noHash', {
          type: 'boolean',
          nargs: 0,
          demandOption: false,
          describe: `Whether to use hash in case of duplications, defaults to false`,
        })
        .parse()
    )

    return {
      argv() {
        return argv
      },
      async * execute(options: CommonCreateOptions) {
        console.log(`downloading ${info.data.type} ${info.data.id}`)
        if (argv.token) {
          console.log(`using token ${argv.token}`)
        } else {
          console.log(`using temporary token`)
        }

        const concurrency = formatConcurrent(argv.concurrent)

        console.log(`concurrent ${concurrency}`)

        const folderPath = path.resolve(process.cwd(), options.projectPath || '')

        const execute = call(() => {
          const { data } = info

          if (data.type === 'slot') {
            const { eventType } = argv
            return () => executeSlot({
              type: eventType === 'chase' ? 'chase' : eventType === 'vod' ? 'vod' : undefined,
              concurrency,
              folderPath,
              token: argv.token,
              slotId: data.id,
              ensureUnique: !argv.noHash,
            })
          }

          if (data.type === 'onair') {
            return () => executeOnair({
              concurrency,
              folderPath,
              token: argv.token,
              channelId: data.id,
              ensureUnique: !argv.noHash,
            })
          }

          if (data.type === 'episode') {
            return () => executeEpisode({
              concurrency,
              folderPath,
              token: argv.token,
              episodeId: data.id,
              ensureUnique: !argv.noHash,
            })
          }

          if (data.type === 'series') {
            return () => executeSeries({
              concurrency,
              folderPath,
              token: argv.token,
              seriesId: data.id,
              seasonId: data.seasonId,
              ensureUnique: !argv.noHash,
            })
          }

          throw fail(`unsupported type ${data.type}`)
        })

        yield 'prepared' as const

        await execute()
      },
    }
  }
}

async function executeEpisode(options: {
  readonly concurrency: number
  readonly folderPath: string
  readonly token: string | undefined
  readonly episodeId: string
  readonly ensureUnique: boolean
}) {
  const { folderPath, concurrency, token, episodeId, ensureUnique } = options

  const { usertoken, deviceId } = await getUserData(token)

  const episodeInfo = await ensure(() => getVideoProgramInfo(usertoken, episodeId))

  const streamListUrl = episodeInfo.playback.hls
  const { title } = episodeInfo.episode

  const fileTitle = title ? filenamify(title, { replacement: '-' }) : ''
  const fileHash = fileTitle && !ensureUnique ? '' : format(new Date(), 'yyyyLLddHHmmss')
  const fileName = [fileTitle, fileHash, 'mp4'].filter(Boolean).join('.')
  const filePath = path.join(folderPath, fileName)

  console.log(`writing to ${filePath}`)

  await fs.promises.mkdir(folderPath, { recursive: true })

  const playListUrl = await parseStreamList({
    url: streamListUrl,
    usertoken: undefined,
  })

  if (!playListUrl) return

  const { actions } = loopPlayList({
    shouldLoop: false,
    url: playListUrl.toString(),
  })

  await executeHls({
    url: playListUrl,
    filePath,
    concurrency,
    actions,
    usertoken,
    deviceId,
  })
}

async function executeOnair(options: {
  readonly concurrency: number
  readonly folderPath: string
  readonly token: string | undefined
  readonly channelId: string
  readonly ensureUnique: boolean
}) {
  const { folderPath, concurrency, token, channelId, ensureUnique } = options

  const { usertoken, deviceId } = await getUserData(token)

  const channels = await ensure(() => getChannelList(channelId === 'news-global' ? { division: '1' } : undefined))

  const channel = channels.find(x => x.id === channelId)

  if (!channel) {
    throw fail(`Channel ${channelId} not found`)
  }

  const streamListUrl = channel.playback.hls
  const title = channel.name

  const fileTitle = title ? filenamify(title, { replacement: '-' }) : ''
  const fileHash = fileTitle && !ensureUnique ? '' : format(new Date(), 'yyyyLLddHHmmss')
  const fileName = [fileTitle, fileHash, 'mp4'].filter(Boolean).join('.')
  const filePath = path.join(folderPath, fileName)

  console.log(`writing to ${filePath}`)

  await fs.promises.mkdir(folderPath, { recursive: true })

  const playListUrl = await parseStreamList({
    url: streamListUrl,
    usertoken: undefined,
  })

  if (!playListUrl) return

  const { actions } = loopPlayList({
    shouldLoop: true,
    url: playListUrl.toString(),
  })

  await executeHls({
    url: playListUrl,
    filePath,
    concurrency,
    actions,
    usertoken,
    deviceId,
  })
}

async function executeSeries(options: {
  readonly concurrency: number
  readonly folderPath: string
  readonly token: string | undefined
  readonly seriesId: string
  readonly seasonId: string | undefined
  readonly ensureUnique: boolean
}) {
  const { folderPath, concurrency, token, seriesId, seasonId, ensureUnique } = options

  const { usertoken } = await getUserData(token)

  const seriesInfo = await ensure(() => getVideoSeriesInfo(usertoken, seriesId))

  const { title } = seriesInfo

  if (seasonId) {
    console.log(`season ${seasonId}`)
  }

  const seasons = seasonId ? seriesInfo.orderedSeasons.filter(x => x.id === seasonId) : seriesInfo.orderedSeasons

  const projectTitle = title ? filenamify(title, { replacement: '-' }) : ''
  const projectHash = projectTitle && !ensureUnique ? '' : format(new Date(), 'yyyyLLddHHmmss')
  const projectName = [projectTitle, projectHash].filter(Boolean).join('.')
  const projectPath = path.join(folderPath, projectName)

  console.log(`writing to ${projectPath}`)

  await fs.promises.mkdir(projectPath, { recursive: true })

  for (const season of seasons) {
    const seasonPath = path.join(projectPath, filenamify(season.name, { replacement: '-' }))
    const list = await exaustList(40, async (offset, limit) => {
      const result = await ensure(() =>
        getVideoSeriesProgramsInfo(usertoken, seriesInfo.id, seriesInfo.version, season.id, {
          offset,
          limit,
        })
      )
      return result.programs
    })
    for (const item of list) {
      console.log(chalk.greenBright(`${season.name}    ${item.episode.title}`))
      await executeEpisode({
        concurrency,
        folderPath: seasonPath,
        token: usertoken,
        episodeId: item.id,
        ensureUnique: false,
      })
    }
  }
}

async function executeSlot(options: {
  readonly type?: 'chase' | 'vod'
  readonly concurrency: number
  readonly folderPath: string
  readonly token: string | undefined
  readonly slotId: string
  readonly ensureUnique: boolean
}) {
  const { type: inputType, folderPath, concurrency, token, slotId, ensureUnique } = options

  const { usertoken, deviceId } = await getUserData(token)

  const slotInfo = await ensure(() => getSlotInfo(usertoken, slotId))

  const { title } = slotInfo

  const fileTitle = title ? filenamify(title, { replacement: '-' }) : ''
  const fileHash = fileTitle && !ensureUnique ? '' : format(new Date(), 'yyyyLLddHHmmss')
  const fileName = [fileTitle, fileHash, 'mp4'].filter(Boolean).join('.')
  const filePath = path.join(folderPath, fileName)

  console.log(`writing to ${filePath}`)

  await fs.promises.mkdir(folderPath, { recursive: true })

  const endAt = slotInfo.endAt * 1000

  const { type, getStreamListUrl } = await call(async () => {
    const now = Date.now()
    if (inputType === 'chase' || !inputType && endAt > now) {
      return {
        type: 'chase' as const,
        getStreamListUrl: () => getSlotChaseStreamListUrl(slotId),
      }
    } else {
      if (endAt > Date.now()) {
        throw fail(`when slot is not ended, can only get chase list`)
      }
      return {
        type: 'vod' as const,
        getStreamListUrl: () => getSlotVodStreamListUrl(slotId),
      }
    }
  })

  console.log(`event mode: ${type}`)

  const playListUrl = await parseStreamList({
    url: getStreamListUrl(),
    usertoken,
  })

  if (!playListUrl) return

  const { actions } = loopPlayList({
    shouldLoop: type === 'chase',
    url: playListUrl.toString(),
  })

  await executeHls({
    url: playListUrl,
    filePath,
    concurrency,
    actions,
    usertoken,
    deviceId,
  })
}

function loopPlayList(options: {
  readonly url: string
  readonly shouldLoop: boolean
}) {
  const { url, shouldLoop } = options

  const m3uActions = new PipeStream<M3UAction & { mediaSequence: number }>()

  let destroyed = false

  // loop playlist
  call(async () => {
    const reader = new M3UReader()

    let globalMediaSequence = 0

    while (true) {
      if (destroyed) return

      const playlist = await ensure(async () => {
        const res = await get<string>(url, { responseType: 'text' })
        return res.data
      })

      let mediaSequence = 0
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
            }
          }
          if (action.kind === 'track') {
            if (mediaSequence > globalMediaSequence) {
              globalMediaSequence = mediaSequence
              m3uActions.write({
                ...action,
                mediaSequence,
              })
            }
            mediaSequence++
          } else {
            if (mediaSequence > globalMediaSequence) {
              m3uActions.write({
                ...action,
                mediaSequence,
              })
            }
          }
        }
      }

      if (!shouldLoop) break

      // since each chunk is nearly 4s or 5s, set it at 5s
      await later(5000)
    }
  })

  return {
    actions: m3uActions,
    dispose: () => { destroyed = true }
  }
}

async function parseStreamList(options: {
  readonly url: string
  readonly usertoken: string | undefined
}) {
  const { url, usertoken } = options
  const content = await getAnyPlaylist(url, usertoken)

  const choices: Array<{
    url: string
    bandwidth: number
    resolution?: {
      width: number
      height: number
    }
  }> = []

  const reader = new M3UReader()

  for await (const line of readlineFromBuffer(content)) {
    reader.push(line)
  }

  for (const choice of reader.actions) {
    if (choice.kind === 'stream') {
      const map = parseProperties(choice.value)

      const bandwidth = call(() => {
        const str = map.get('BANDWIDTH')
        const value = +String(str)
        if (!(Number.isFinite(value) && value > 0)) {
          throw fail(`Incorrect bandwidth ${str}`)
        }
        return value
      })

      const resolution = call(() => {
        const str = map.get('RESOLUTION')
        const match = str?.match(/^(?<width>[1-9][0-9]*?)x(?<height>[1-9][0-9]*?)$/)
        if (!match) return
        return {
          width: +match.groups!.width,
          height: +match.groups!.height,
        }
      })

      choices.push({ bandwidth, resolution, url: choice.url })
    }
  }

  if (!choices.length) {
    console.error(chalk.redBright(`No stream found`))
    return
  }

  const pickedChoice = choices.slice().sort((a, b) => b.bandwidth - a.bandwidth)[0]

  console.log()

  console.log(`Found multiple streams:`)

  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i]
    const used = choice === pickedChoice
    const msg = `[${i}] ${choice.resolution && `${choice.resolution.width}x${choice.resolution.height}`} ${!used ? '' : '[used]'}`
    console.log(used ? chalk.white(msg) : chalk.gray(msg))
  }

  const playListUrl = call(() => {
    const u = new URL(url)
    const [uri, query] = pickedChoice.url.split('?')
    u.pathname = path.dirname(u.pathname) + '/' + uri
    u.search = query
    return u
  })

  console.log()

  console.log(`using manifest: ${playListUrl.toString()}`)

  console.log()

  return playListUrl
}

async function executeHls(options: {
  readonly url: URL,
  readonly filePath: string
  readonly concurrency: number
  readonly actions: AsyncIterable<M3UAction> | Iterable<M3UAction>,
  readonly usertoken: string
  readonly deviceId: string
}) {
  const { filePath, concurrency, actions, usertoken, deviceId } = options

  const domain = call(() => {
    const url = new URL(options.url.toString())
    url.pathname = '/'
    url.search = ''
    return url.toString()
  })

  let decoder = defaultDecoder

  const concurrent = new PipeStream<void>()
  for (let i = 0; i < concurrency; i++) {
    concurrent.write()
  }

  const progressBar = new ProgressBar({
    smooth: 100,
    freshRate: 1,
    formatValue: (value, _, type) => {
      if (type === 'value' || type === 'total') {
        return stringifyDuration(formatDurationInSeconds(Math.floor(+value)))
      }
      return value
    }
  })

  progressBar.start()

  const writeSequence = createSequancePromise()

  const writeStream = fs.createWriteStream(filePath)

  for await (const action of actions) {
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
          const ticket = parseTicket(uri)
          if (!ticket) throw new Error(`Failed to parse ticket`)
          const ivString = parseIV(ivInput)
          if (!ivString) throw new Error(`Failed to parse iv`)
          const iv = Buffer.from(ivString, 'hex')
          await ensure(async () => {
            const mediaToken = await getMediaToken(usertoken)
            const license = await getHLSLicenseFromTicket(mediaToken, ticket)
            const encodedVideoKey = readEncodedVideoKey(license.k)
            const videoKey = getVideoKeyFromHLSLicense(deviceId, license.cid, encodedVideoKey)
            decoder = buffer => decodeAES(buffer, videoKey, iv)
          })
        } else {
          throw new Error(`Unknown method ${method}, ${Array.from(map.entries()).map(([key, value]) => `${key}=${value}`).join(',')}`)
        }
        concurrent.write()
      }
    } else if (action.kind === 'track') {
      const url = `${domain}${action.url}`
      const currentDecoder = decoder

      progressBar.increaseTotal(action.duration)

      const bufferPromise = concurrent.read().then(async () => {
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
        writeStream.write(await bufferPromise)
        progressBar.increaseValue(action.duration)
      })
    }
  }

  await writeSequence(() => {})

  progressBar.stop()
}

async function getUserData(token?: string) {
  if (token) {
    const data: { dev: string } = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'))
    return { usertoken: token, deviceId: data.dev }
  } else {
    const deviceId = uuidv4()
    const { token: usertoken } = await createUser(deviceId)
    return { usertoken, deviceId }
  }
}

function defaultDecoder(buffer: Buffer) {
  return buffer
}

function formatConcurrent(x: unknown) {
  const value = Math.ceil(Number(x))
  if(Number.isFinite(value) && value > 0) return value
  return DEFAULT_CONCURRENT
}

function decodeAES(buffer: Buffer, videoKey: Buffer, iv: crypto.BinaryLike) {
  const aes = crypto.createDecipheriv('aes-128-cbc', videoKey, iv)
  aes.setAutoPadding(false)
  return Buffer.concat([aes.update(buffer), aes.final()])
}
