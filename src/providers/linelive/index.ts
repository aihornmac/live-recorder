import * as path from 'path'
import * as fs from 'fs'
import * as yargs from 'yargs'
import { format } from 'date-fns'
import { URL } from 'url'
import * as chalk from 'chalk'

import { CommonCreateOptions, CommonArgv } from '../common/typed-input'
import { call, predicate, later } from '../../utils/js'
import {
  getPlayerStatus,
} from './api'
import { parseUrl } from './dispatch'
import { loopPlayList, pickStream, printStreamChoices, HLSExecutor, createHLSProgressBar } from '../common/hls'

const DEFAULT_CONCURRENT = 8

export const commands = undefined

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
        console.log(`downloading`, info.data)

        const contents = formatContent(argv.content || '')
        if (!contents.size) contents.add('video')

        console.log(`recording ${Array.from(contents).join(',')}`)

        const concurrency = formatConcurrent(argv.concurrent)

        console.log(`concurrent ${concurrency}`)

        const folderPath = path.resolve(process.cwd(), options.projectPath || '')

        yield 'prepared' as const

        await execute({
          concurrency,
          folderPath,
          ensureUnique: !argv.noHash,
          contents,
          channelId: info.data.channelId,
          broadcastId: info.data.broadcastId,
        })
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
  readonly ensureUnique: boolean
  readonly contents: ReadonlySet<ContentType>
}

async function execute(options: CommonExecutionOptions & {
  readonly channelId: number
  readonly broadcastId: number
}) {
  const { folderPath, concurrency, channelId, broadcastId, contents } = options

  const fileHash = format(new Date(), 'yyyyLLddHHmmss')
  const projectName = fileHash
  const projectPath = path.join(folderPath, projectName)

  console.log(`writing to ${projectPath}`)

  const { type: streamType, list: streamList } = await call(async () => {
    while (true) {
      const { type, list } = await call(async () => {
        const ret = await getPlayerStatus(channelId, broadcastId)
        const { type, map } = call(() => {
          if (ret.liveStatus === 'LIVE') {
            return { type: 'live' as const, map: ret.liveHLSURLs }
          } else if (ret.liveStatus === 'FINISHED') {
            return { type: 'archive' as const, map: ret.archivedHLSURLs }
          }
          return { type: 'live' as const, map: {} }
        })
        return {
          type,
          list: Object.entries(map)
            .map(([key, value]) => {
              const height = +key
              return !(height > 0) || !value ? undefined : {
                url: value,
                data: {
                  RESOLUTION: {
                    height,
                  }
                },
              }
            })
            .filter(predicate)
            .sort((a, b) => a.data.RESOLUTION.height - b.data.RESOLUTION.height)
        }
      })

      if (list.length) return { type, list }

      console.error(chalk.redBright(`No stream found`))

      await later(2000)
    }
  })

  console.log(`recording ${streamType}`)

  const pickedStream = pickStream(streamList, 'best')!

  printStreamChoices(streamList, pickedStream)

  const { actions } = loopPlayList({
    getPlayList: pickedStream.url,
    interval: 1000,
  })

  await fs.promises.mkdir(projectPath, { recursive: true })

  const filePath = path.join(projectPath, 'merged.mp4')

  const progressBar = createHLSProgressBar()

  const hls = new HLSExecutor({
    url: pickedStream.url,
    actions,
    filePath,
    concurrency,
    contents: new Set(Array.from(contents).map(content => content === 'video' ? 'merged' : content)),
  })

  hls.events.on('increase progress', value => progressBar.increaseValue(value))
  hls.events.on('increase total', value => progressBar.increaseTotal(value))

  progressBar.start()

  hls.start()

  await hls.exaust()

  progressBar.stop()
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
