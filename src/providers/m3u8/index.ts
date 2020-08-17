import * as path from 'path'
import * as fs from 'fs'
import * as yargs from 'yargs'
import { format } from 'date-fns'
import { URL } from 'url'
import * as chalk from 'chalk'

import { CommonCreateOptions, CommonArgv } from '../common/typed-input'
import { ensure } from '../../utils/flow-control'
import { get } from '../../utils/request'
import { parseUrl } from './dispatch'
import { loopPlayList, parseStreamList, parseBandwidth, HLSExecutor, determineM3U8Type } from '../common/hls'
import { pickStream, printStreamChoices, createDownloadProgressBar } from '../common/helpers'

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
          describe: `Specify download content, e.g. 'merged,chunks,m3u8', defaults to 'merged'`,
        })
        .option('interval', {
          type: 'number',
          nargs: 1,
          demandOption: false,
          describe: `Specify fetch playlist interval, defaults to 1000`,
        })
        .option('shareQuery', {
          type: 'boolean',
          demandOption: false,
          describe: `Specify whether to share query string or not`,
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
        console.log(`downloading`, info.data.url)

        const contents = formatContent(argv.content || '')
        if (!contents.size) contents.add('merged')

        console.log(`recording ${Array.from(contents).join(',')}`)

        const concurrency = formatConcurrent(argv.concurrent)

        console.log(`concurrent ${concurrency}`)

        if (argv.shareQuery) {
          console.log(`share query`)
        }

        const folderPath = path.resolve(process.cwd(), options.projectPath || '')

        yield 'prepared' as const

        await execute({
          concurrency,
          folderPath,
          ensureUnique: !argv.noHash,
          interval: argv.interval ?? 1000,
          contents,
          url: url.toString(),
          shareQuery: !!argv.shareQuery,
        })
      },
    }
  }
}

type ContentType = (
  | 'merged'
  | 'chunks'
  | 'm3u8'
)

type CommonExecutionOptions = {
  readonly concurrency: number
  readonly folderPath: string
  readonly interval: number
  readonly ensureUnique: boolean
  readonly contents: ReadonlySet<ContentType>
  readonly shareQuery: boolean
}

async function execute(options: CommonExecutionOptions & {
  readonly url: string
}) {
  const { folderPath, interval, concurrency, url: streamListUrl, contents, shareQuery } = options

  const fileHash = format(new Date(), 'yyyyLLddHHmmss')
  const projectName = [fileHash].filter(Boolean).join('.')
  const projectPath = path.join(folderPath, projectName)

  console.log(`writing to ${projectPath}`)

  const streamListContent = await ensure(async () => {
    const res = await get<string>(streamListUrl, { responseType: 'text' })
    return res.data
  })

  const m3u8Type = await determineM3U8Type(streamListContent)

  const playLists: Array<{ url: string, filePath: string }> = []

  if (m3u8Type === 'stream') {
    const streamList = await parseStreamList({
      content: streamListContent,
      parser: {
        BANDWIDTH: parseBandwidth,
      },
    })

    if (!streamList.length) {
      console.error(chalk.redBright(`No stream found`))
      return
    }

    const pickedStream = pickStream(streamList, 'best')!

    printStreamChoices(streamList, pickedStream)

    playLists.push({
      url: new URL(pickedStream.url, streamListUrl).toString(),
      filePath: path.join(projectPath, 'video.ts'),
    })

    const audioUrl = pickedStream.audio?.uri

    if (typeof audioUrl === 'string') {
      playLists.push({
        url: new URL(audioUrl, streamListUrl).toString(),
        filePath: path.join(projectPath, 'audio.aac'),
      })
    }

    const subtitlesUrl = pickedStream.subtitles?.uri

    if (typeof subtitlesUrl === 'string') {
      playLists.push({
        url: new URL(subtitlesUrl, streamListUrl).toString(),
        filePath: path.join(projectPath, 'subtitiles'),
      })
    }
  } else {
    playLists.push({
      url: streamListUrl,
      filePath: path.join(projectPath, 'stream.ts'),
    })
  }

  const progressBar = createDownloadProgressBar()

  progressBar.start()

  await Promise.all(playLists.map(async ({ url: playListUrl, filePath }) => {
    if (shareQuery) {
      const u = new URL(playListUrl)
      for (const [key, value] of new URL(streamListUrl).searchParams) {
        u.searchParams.append(key, value)
      }
      playListUrl = u.toString()
    }
    const { actions } = loopPlayList({
      getPlayList: playListUrl,
      interval,
    })

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

    const hls = new HLSExecutor({
      url: playListUrl,
      actions,
      filePath,
      concurrency,
      contents,
      shareQuery,
    })

    hls.events.on('increase progress', value => progressBar.increaseValue(value / playLists.length))
    hls.events.on('increase total', value => progressBar.increaseTotal(value / playLists.length))

    hls.start()

    await hls.exaust()
  }))

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
    if (part === 'merged' || part === 'm3u8' || part === 'chunks') {
      parts.push(part)
    } else if (part === 'video' || part === 'audio') {
      parts.push('merged')
    }
  }
  return new Set(parts)
}
