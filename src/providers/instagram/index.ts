import * as path from 'path'
import * as yargs from 'yargs'
import { format } from 'date-fns'
import { URL } from 'url'

import { CommonCreateOptions, CommonArgv } from '../common/typed-input'
import { call, later } from '../../utils/js'
import {
  createClient,
  getLocalStorage,
  logout,
  Broadcast,
} from './api'
import { parseUrl } from './dispatch'
import { input } from '../../utils/prompt'
import { first } from 'lodash'
import { niceToHaveSync } from '../../utils/flow-control'
import * as filenamify from 'filenamify'
import { createDownloadProgressBar } from '../common/helpers'
import { DashExecutor } from '../common/dash'

const DEFAULT_CONCURRENT = 8

export async function commands(list: readonly string[], _yargs: yargs.Argv) {
  const command = list[0] || ''
  if (command === 'logout') {
    await logout()
    console.log(`user is removed`)
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
        .option('content', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: `Specify download content, e.g. 'video,chunks,mpd', defaults to 'video,chunks,mpd'`,
        })
        .option('username', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: `Specify username to login`,
        })
        .option('proxy', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: `Specify proxy url`,
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

        const ls = getLocalStorage()

        const username = await call(async () => {
          const config = await ls.getConfig()
          if (argv.username) {
            await ls.setConfig({ ...config, username: argv.username })
            return argv.username
          }
          if (config?.username) return config?.username
          const name = await input(`Please input username to login (will be saved for next time)`)
          await ls.setConfig({ ...config, username: name })
          return name
        })

        console.log(`using username ${username}`)

        const client = await createClient({
          username,
          proxy: argv.proxy || getProxyFromEnv(),
        })

        const userId = await client.ig.user.getIdByUsername(info.data.account)
        console.log(`user id of ${info.data.account} is ${userId}`)

        yield 'prepared' as const

        const broadcast = await call(async () => {
          while (true) {
            try {
              const ret = await client.ig.feed.userStory(userId).request()
              if (ret.status !== 'ok') {
                console.error(ret)
              }
              const data = ret.broadcast as Broadcast.Broadcast | null
              if (data) return data
              console.log(`Live is not started`)
            } catch (e) {
              console.error(e)
            }
            await later(2000)
          }
        })

        await execute({
          concurrency,
          folderPath,
          ensureUnique: !argv.noHash,
          contents,
          broadcast,
        })
      },
    }
  }
}

type ContentType = (
  | 'video'
  | 'chunks'
  | 'mpd'
)

type CommonExecutionOptions = {
  readonly concurrency: number
  readonly folderPath: string
  readonly ensureUnique: boolean
  readonly contents: ReadonlySet<ContentType>
}

async function execute(options: CommonExecutionOptions & {
  readonly broadcast: Broadcast.Broadcast
}) {
  const { folderPath, concurrency, contents, ensureUnique, broadcast } = options

  const username = niceToHaveSync(() => broadcast.broadcast_owner.username) || ''

  const title = username ? filenamify(username, { replacement: '-' }) : ''
  const hash = title && !ensureUnique ? '' : format(new Date(), 'yyyyLLddHHmmss')
  const projectName = [title, hash].filter(Boolean).join('/')
  const projectPath = path.join(folderPath, projectName)

  console.log(`writing to ${projectPath}`)

  const mpdUrl = broadcast.dash_playback_url

  console.log(`using mpd url ${mpdUrl}`)

  const progressBar = createDownloadProgressBar()

  const dash = new DashExecutor({
    url: mpdUrl,
    folderPath: projectPath,
    concurrency,
    contents: new Set(Array.from(contents).map(content => content === 'video' ? 'merged' : content)),
  })

  dash.events.on('increase progress', value => progressBar.increaseValue(value))
  dash.events.on('increase total', value => progressBar.increaseTotal(value))

  progressBar.start()

  dash.start()

  await dash.exaust()

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
    if (part === 'video' || part === 'mpd' || part === 'chunks') {
      parts.push(part)
    }
  }
  if (!parts.length) {
    parts.push('video', 'chunks', 'mpd')
  }
  return new Set(parts)
}

function getProxyFromEnv() {
  const { env } = process
  return first(['http_proxy', 'all_proxy'].map(key => env[key]).filter(Boolean))
}
