import * as path from 'path'
import * as fs from 'fs'
import * as yargs from 'yargs'
import { format } from 'date-fns'
import { URL } from 'url'
import * as chalk from 'chalk'
import * as filenamify from 'filenamify'

import { CommonCreateOptions, CommonArgv } from '../common/typed-input'
import { M3UAction } from '../../utils/m3u'
import { call, createSequancePromise, once } from '../../utils/js'
import {
  createClient,
  getProgramStreamList,
  Client,
  getProgramByStartTime,
  getProgramStreamListUrl,
} from './api'
import { PipeStream } from '../../utils/stream'
import { ensure } from '../../utils/flow-control'
import { get } from '../../utils/request'
import { parseUrl } from './dispatch'
import { fail } from '../../utils/error'
import { ProgressBar } from '../../utils/progress-bar'
import { formatDurationInSeconds, stringifyDuration } from '../common/helpers'
import { ConfigOperator } from '../common/config'
import { waitForWriteStreamFinish } from '../../utils/node-stream'
import { loopPlayList, parseStreamList, parseBandwidth, pickStream, printStreamChoices } from '../common/hls'
import { extname } from 'path'

const PROVIDER = 'radiko'

const DEFAULT_CONCURRENT = 8

export interface Config {
  readonly login?: {
    readonly mail: string
    readonly cipher: string
  }
}

const getConfigOperator = once(() => new ConfigOperator<Config>(PROVIDER))

export async function commands(list: readonly string[], yargs: yargs.Argv) {
  const command = list[0] || ''
  const rest = list.slice(1)
  if (command === 'login') {
    const argv = (
      yargs
        .option('mail', {
          type: 'string',
          nargs: 1,
          demandOption: true,
          describe: 'Specify mail',
        })
        .option('password', {
          type: 'string',
          nargs: 1,
          demandOption: true,
          describe: 'Specify password',
        })
        .parse(rest)
    )
    const { mail, password } = argv
    const op = getConfigOperator()
    await op.set({
      ...await op.get(),
      login: {
        mail,
        cipher: Buffer.from(password, 'utf8').toString('base64'),
      }
    })
    console.log(`user is set to ${mail}`)
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
        .option('mail', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: 'Specify mail, defaults to mail in configuration, or anonymous user if unset',
        })
        .option('password', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: 'Specify password, defaults to password in configuration, or anonymous user if unset',
        })
        .option('content', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: `Specify download content, e.g. 'audio,chunks,m3u8,cover', defaults to 'audio'`,
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

        let login: undefined | {
          readonly mail: string
          readonly password: string
        }

        if (argv.mail && argv.password) {
          login = {
            mail: argv.mail,
            password: argv.password,
          }
          console.log(`using user ${argv.mail}`)
        } else {
          const presetLogin = (await getConfigOperator().get())?.login
          if (presetLogin) {
            login = {
              mail: presetLogin.mail,
              password: Buffer.from(presetLogin.cipher, 'base64').toString('utf8'),
            }
            console.log(`using user ${login.mail} in configuration`)
          } else {
            console.log(`using anonymous user`)
          }
        }

        const contents = formatContent(argv.content || '')
        if (!contents.size) contents.add('audio')

        console.log(`recording ${Array.from(contents).join(',')}`)

        const concurrency = formatConcurrent(argv.concurrent)

        console.log(`concurrent ${concurrency}`)

        const client = await createClient({ login })

        const folderPath = path.resolve(process.cwd(), options.projectPath || '')

        const execute = call(() => {
          const { data } = info

          if (data.type === 'station') {
            const { startTime } = data
            console.log({ data })
            if (startTime) {
              return () => executeStationByStartTime({
                stationId: data.id,
                startTime,
                client,
                concurrency,
                folderPath,
                ensureUnique: !argv.noHash,
                contents,
              })
            }
          }

          throw fail(`unsupported type ${data.type}`)
        })

        yield 'prepared' as const

        await execute()
      },
    }
  }
}

async function executeStationByStartTime(options: CommonExecutionOptions & {
  readonly stationId: string
  readonly startTime: number
}) {
  const { stationId, startTime, client, folderPath, concurrency, ensureUnique, contents } = options

  const program = await getProgramByStartTime(client, {
    stationId,
    startTime,
  })
  if (!program) return

  const { title } = program

  const fileTitle = title ? filenamify(title, { replacement: '-' }) : ''
  const fileHash = fileTitle && !ensureUnique ? '' : format(new Date(), 'yyyyLLddHHmmss')

  const downloadCoverPromise = !contents.has('cover') ? undefined : call(() => ensure(async () => {
    const ext = extname(program.img) || '.png'
    const fileName = [fileTitle, String(startTime), 'cover', fileHash].filter(Boolean).join('.') + ext
    const filePath = path.join(folderPath, fileName)

    console.log(`writing cover to ${filePath}`)

    const buffer = await ensure(async () => {
      const res = await get<Buffer>(program.img, { responseType: 'arraybuffer' })
      return res.data
    })
    await fs.promises.writeFile(filePath, buffer)
  }))

  const hlsPromise = !(
    contents.has('audio') ||
    contents.has('chunks') ||
    contents.has('m3u8')
  ) ? undefined : call(async () => {
    const fileName = [fileTitle, String(startTime), fileHash, 'aac'].filter(Boolean).join('.')
    const filePath = path.join(folderPath, fileName)

    console.log(`writing hls to ${filePath}`)

    const streamListContent = await getProgramStreamList(client, {
      stationId,
      fromTime: +program['@_ft'],
      toTime: +program['@_to'],
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

    const playListUrl = new URL(pickedStream.url, getProgramStreamListUrl()).toString()

    const { actions } = loopPlayList({
      url: playListUrl.toString(),
      interval: 5000,
    })

    await executeHls({
      url: playListUrl,
      filePath,
      concurrency,
      actions,
      contents,
    })
  })



  await Promise.all([
    downloadCoverPromise,
    hlsPromise,
  ])
}

async function executeHls(options: {
  readonly url: string,
  readonly filePath: string
  readonly concurrency: number
  readonly actions: AsyncIterable<SequencedM3UAction> | Iterable<SequencedM3UAction>,
  readonly contents: ReadonlySet<ContentType>
}) {
  const { filePath, concurrency, actions, contents } = options

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

  const chunksPath = filePath + '.chunks'
  const audioWriteStream = contents.has('audio') ? fs.createWriteStream(filePath) : undefined
  const m3u8WriteStream = contents.has('m3u8') ? fs.createWriteStream(filePath + '.m3u8.json') : undefined

  if (contents.has('chunks')) {
    await fs.promises.mkdir(chunksPath, { recursive: true })
  }

  progressBar.start()

  const writeSequence = createSequancePromise()

  for await (const action of actions) {
    if (m3u8WriteStream) {
      m3u8WriteStream.write(JSON.stringify(action))
      m3u8WriteStream.write('\n')
    }
    if (audioWriteStream || contents.has('chunks')) {
      if (action.kind === 'track') {
        const u = new URL(action.url, options.url)
        const url = u.toString()

        progressBar.increaseTotal(action.duration)

        let bufferPromise = concurrent.read().then(async () => {
          try {
            return await ensure(async () => {
              const res = await get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
              return Buffer.from(res.data)
            })
          } finally {
            concurrent.write()
          }
        })

        writeSequence(async () => {
          const buffer = await bufferPromise
          if (contents.has('chunks')) {
            const ext = path.extname(u.pathname)
            await fs.promises.writeFile(path.join(chunksPath, `${action.mediaSequence}${ext}`), buffer)
          }
          if (audioWriteStream) {
            audioWriteStream.write(buffer)
          }
          progressBar.increaseValue(action.duration)
        })
      }
    } else {
      if (action.kind === 'track') {
        progressBar.increaseTotal(action.duration)
        progressBar.increaseValue(action.duration)
      }
    }
  }

  await writeSequence(() => {})

  await Promise.all([
    audioWriteStream,
    m3u8WriteStream,
  ].map(writeStream =>
    writeStream && call(() => {
      const promise = waitForWriteStreamFinish(writeStream)
      writeStream.end()
      return promise
    })
  ))

  progressBar.stop()
}

type CommonExecutionOptions = {
  readonly client: Client
  readonly concurrency: number
  readonly folderPath: string
  readonly ensureUnique: boolean
  readonly contents: ReadonlySet<ContentType>
}

type SequencedM3UAction = M3UAction & { mediaSequence: number }

type ContentType = (
  | 'audio'
  | 'chunks'
  | 'm3u8'
  | 'cover'
)

function formatConcurrent(x: unknown) {
  const value = Math.ceil(Number(x))
  if(Number.isFinite(value) && value > 0) return value
  return DEFAULT_CONCURRENT
}

function formatContent(x: string) {
  const parts: Array<ContentType> = []
  for (const part of x.split(/[^a-zA-Z0-9-]/)) {
    if (part === 'audio' || part === 'm3u8' || part === 'chunks' || part === 'cover') {
      parts.push(part)
    }
  }
  return new Set(parts)
}
