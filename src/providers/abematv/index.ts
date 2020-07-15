import * as path from 'path'
import * as fs from 'fs'
import * as yargs from 'yargs'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'
import { URL } from 'url'
import * as chalk from 'chalk'
import * as filenamify from 'filenamify'

import { CommonCreateOptions, CommonArgv } from '../common/typed-input'
import { call, once } from '../../utils/js'
import {
  createUser,
  parseTicket,
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
import { ensure, exaustList } from '../../utils/flow-control'
import { parseUrl } from './dispatch'
import { fail } from '../../utils/error'
import { LocalStorage } from '../common/localstorage'
import {
  loopPlayList,
  SequencedM3UAction,
  parseStreamList,
  parseBandwidth,
  parseResolution,
  pickStream,
  printStreamChoices,
  HLSExecutor,
  HLSExecutorOptions,
  createHLSProgressBar,
} from '../common/hls'

const PROVIDER = 'abematv'

const DEFAULT_CONCURRENT = 8

export interface Config {
  readonly token?: string
}

const getLocalStorage = once(() => new LocalStorage<Config>(PROVIDER))

export async function commands(list: readonly string[], yargs: yargs.Argv) {
  const command = list[0] || ''
  const rest = list.slice(1)
  if (command === 'login') {
    const argv = (
      yargs
        .option('token', {
          type: 'string',
          nargs: 1,
          demandOption: true,
          describe: 'Specify download token',
        })
        .parse(rest)
    )
    const { token } = argv
    const ls = getLocalStorage()
    await ls.setConfig({
      ...await ls.getConfig(),
      token,
    })
    console.log(`token is set to ${token}`)
  }
}

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
          describe: 'Specify download token, defaults to token in configuration, or anonymous user if unset',
        })
        .option('eventType', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: `Specify event type, could be 'vod' or 'chase', defaults to vod if ended, chase if not`,
        })
        .option('content', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: `Specify download content, e.g. 'video,chunks,m3u8', defaults to 'video'`,
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

        let usertoken: string | undefined

        if (argv.token) {
          usertoken = argv.token
          console.log(`using token ${argv.token}`)
        } else {
          const presetToken = (await getLocalStorage().getConfig())?.token
          if (presetToken) {
            usertoken = presetToken
            console.log(`using token in configuration ${presetToken}`)
          } else {
            console.log(`using temporary token`)
          }
        }

        const contents = formatContent(argv.content || '')
        if (!contents.size) contents.add('video')

        console.log(`recording ${Array.from(contents).join(',')}`)

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
              token: usertoken,
              slotId: data.id,
              ensureUnique: !argv.noHash,
              contents,
            })
          }

          if (data.type === 'onair') {
            return () => executeOnair({
              concurrency,
              folderPath,
              token: usertoken,
              channelId: data.id,
              ensureUnique: !argv.noHash,
              contents,
            })
          }

          if (data.type === 'episode') {
            return () => executeEpisode({
              concurrency,
              folderPath,
              token: usertoken,
              episodeId: data.id,
              ensureUnique: !argv.noHash,
              contents,
            })
          }

          if (data.type === 'series') {
            return () => executeSeries({
              concurrency,
              folderPath,
              token: usertoken,
              seriesId: data.id,
              seasonId: data.seasonId,
              ensureUnique: !argv.noHash,
              contents,
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

type ContentType = (
  | 'video'
  | 'chunks'
  | 'm3u8'
)

type CommonExecutionOptions = {
  readonly concurrency: number
  readonly folderPath: string
  readonly token: string | undefined
  readonly ensureUnique: boolean
  readonly contents: ReadonlySet<ContentType>
}

async function executeEpisode(options: CommonExecutionOptions & {
  readonly episodeId: string
}) {
  const { folderPath, concurrency, token, episodeId, ensureUnique, contents } = options

  const { usertoken, deviceId } = await getUserData(token)

  const episodeInfo = await ensure(() => getVideoProgramInfo(usertoken, episodeId))

  const streamListUrl = episodeInfo.playback.hls
  const { title } = episodeInfo.episode

  const fileTitle = title ? filenamify(title, { replacement: '-' }) : ''
  const fileHash = fileTitle && !ensureUnique ? '' : format(new Date(), 'yyyyLLddHHmmss')
  const fileName = [fileTitle, fileHash].filter(Boolean).join('.')
  const filePath = path.join(folderPath, fileName, 'video.mp4')

  console.log(`writing to ${filePath}`)

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

  const playListUrl = await getStream({
    url: streamListUrl,
    usertoken: undefined,
  })

  if (!playListUrl) return

  const { actions } = loopPlayList({
    getPlayList: playListUrl.toString(),
    interval: 5000,
  })

  await executeHls({
    url: playListUrl,
    filePath,
    concurrency,
    actions,
    usertoken,
    deviceId,
    contents,
  })
}

async function executeOnair(options: CommonExecutionOptions & {
  readonly channelId: string
}) {
  const { folderPath, concurrency, token, channelId, ensureUnique, contents } = options

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
  const fileName = [fileTitle, fileHash].filter(Boolean).join('.')
  const filePath = path.join(folderPath, fileName, 'video.mp4')

  console.log(`writing to ${filePath}`)

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

  const playListUrl = await getStream({
    url: streamListUrl,
    usertoken: undefined,
  })

  if (!playListUrl) return

  const { actions } = loopPlayList({
    getPlayList: playListUrl.toString(),
    interval: 5000,
  })

  await executeHls({
    url: playListUrl,
    filePath,
    concurrency,
    actions,
    usertoken,
    deviceId,
    contents,
  })
}

async function executeSeries(options: CommonExecutionOptions & {
  readonly seriesId: string
  readonly seasonId: string | undefined
}) {
  const { folderPath, token, seriesId, seasonId, ensureUnique } = options

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
        ...options,
        folderPath: seasonPath,
        token: usertoken,
        episodeId: item.id,
        ensureUnique: false,
      })
    }
  }
}

async function executeSlot(options: CommonExecutionOptions & {
  readonly type: 'chase' | 'vod' | undefined
  readonly slotId: string
}) {
  const { type: inputType, folderPath, concurrency, token, slotId, ensureUnique, contents } = options

  const { usertoken, deviceId } = await getUserData(token)

  const slotInfo = await ensure(() => getSlotInfo(usertoken, slotId))

  const { title } = slotInfo

  const fileTitle = title ? filenamify(title, { replacement: '-' }) : ''
  const fileHash = fileTitle && !ensureUnique ? '' : format(new Date(), 'yyyyLLddHHmmss')
  const fileName = [fileTitle, fileHash].filter(Boolean).join('.')
  const filePath = path.join(folderPath, fileName, 'video.mp4')

  console.log(`writing to ${filePath}`)

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

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

  const playListUrl = await getStream({
    url: getStreamListUrl(),
    usertoken,
  })

  if (!playListUrl) return

  const { actions } = loopPlayList({
    getPlayList: playListUrl.toString(),
    interval: 5000,
  })

  await executeHls({
    url: playListUrl,
    filePath,
    concurrency,
    actions,
    usertoken,
    deviceId,
    contents,
  })
}

async function getStream(options: {
  readonly url: string
  readonly usertoken: string | undefined
}) {
  const { url, usertoken } = options
  const content = await getAnyPlaylist(url, usertoken)

  const streams = await parseStreamList({
    content,
    parser: {
      BANDWIDTH: parseBandwidth,
      RESOLUTION: parseResolution,
    }
  })

  if (!streams.length) {
    console.error(chalk.redBright(`No stream found`))
    return
  }

  const pickedStream = pickStream(streams, 'best')!

  console.log()

  printStreamChoices(streams, pickedStream)

  const playListUrl = new URL(pickedStream.url, url)

  console.log()

  console.log(`using manifest: ${playListUrl}`)

  console.log()

  return playListUrl
}

interface AbemaTVHLSExecutorOptions extends HLSExecutorOptions {
  readonly usertoken: string
  readonly deviceId: string
}

class AbemaTVHLSExecutor extends HLSExecutor<AbemaTVHLSExecutorOptions> {
  protected async _downloadLicense(uri: string) {
    const ticket = parseTicket(uri)
    if (!ticket) throw new Error(`Failed to parse ticket`)
    const { usertoken, deviceId } = this.options
    const mediaToken = await getMediaToken(usertoken)
    const license = await getHLSLicenseFromTicket(mediaToken, ticket)
    const encodedVideoKey = readEncodedVideoKey(license.k)
    return getVideoKeyFromHLSLicense(deviceId, license.cid, encodedVideoKey)
  }
}

async function executeHls(options: {
  readonly url: URL,
  readonly filePath: string
  readonly concurrency: number
  readonly actions: AsyncIterable<SequencedM3UAction> | Iterable<SequencedM3UAction>,
  readonly usertoken: string
  readonly deviceId: string
  readonly contents: ReadonlySet<ContentType>
}) {
  const { url, filePath, concurrency, actions, usertoken, deviceId, contents } = options

  const progressBar = createHLSProgressBar()

  progressBar.start()

  const hls = new AbemaTVHLSExecutor({
    url: url.toString(),
    filePath,
    usertoken,
    deviceId,
    concurrency,
    actions,
    contents: new Set(Array.from(contents).map(content => content === 'video' ? 'merged' : content)),
  })

  hls.events.on('increase progress', value => progressBar.increaseValue(value))
  hls.events.on('increase total', value => progressBar.increaseTotal(value))

  hls.start()

  await hls.exaust()

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

function formatConcurrent(x: unknown) {
  const value = Math.ceil(Number(x))
  if(Number.isFinite(value) && value > 0) return value
  return DEFAULT_CONCURRENT
}

function formatContent(x: string) {
  const parts: Array<ContentType> = []
  for (const part of x.split(/[^a-zA-Z0-9-]/)) {
    if (part === 'video' || part === 'm3u8' || part === 'chunks') {
      parts.push(part)
    }
  }
  return new Set(parts)
}
