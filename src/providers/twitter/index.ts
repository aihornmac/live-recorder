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
import { loopPlayList, parseStreamList, parseBandwidth, HLSExecutor } from '../common/hls'
import { getStreamData, createClient } from './api'
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
        console.log(`downloading`, info.data.id)

        const contents = formatContent(argv.content || '')
        if (!contents.size) contents.add('merged')

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
          id: info.data.id,
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
  readonly ensureUnique: boolean
  readonly contents: ReadonlySet<ContentType>
}

async function execute(options: CommonExecutionOptions & {
  readonly id: string
}) {
  const { folderPath, concurrency, id, ensureUnique, contents } = options

  const fileTitle = id
  const fileHash = !ensureUnique ? '' : format(new Date(), 'yyyyLLddHHmmss')
  const projectName = [fileTitle, fileHash].filter(Boolean).join('.')
  const projectPath = path.join(folderPath, projectName)

  console.log(`writing to ${projectPath}`)

  const client = await createClient()

  const stream = await getStreamData(client, id)

  const streamListUrl = stream.track.playbackUrl

  console.log(`stream list url: ${streamListUrl}`)

  const streamListContent = await ensure(async () => {
    const res = await get<string>(streamListUrl, { responseType: 'text' })
    return res.data
  })

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

  const playLists: Array<{ url: string, filePath: string }> = []

  playLists.push({
    url: new URL(pickedStream.url, streamListUrl).toString(),
    filePath: path.join(projectPath, 'video.ts'),
  })

  const audioUrl = pickedStream.data.AUDIO

  if (typeof audioUrl === 'string') {
    playLists.push({
      url: new URL(audioUrl, streamListUrl).toString(),
      filePath: path.join(projectPath, 'audio.aac'),
    })
  }

  const progressBar = createDownloadProgressBar()

  progressBar.start()

  await Promise.all(playLists.map(async ({ url: playListUrl, filePath }) => {
    const { actions } = loopPlayList({
      getPlayList: playListUrl,
      interval: 5000,
    })

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

    const hls = new HLSExecutor({
      url: playListUrl,
      actions,
      filePath,
      concurrency,
      contents,
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
    }
  }
  return new Set(parts)
}
