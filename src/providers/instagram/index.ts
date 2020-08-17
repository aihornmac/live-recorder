import * as path from 'path'
import * as fs from 'fs'
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
  Client,
} from './api'
import { parseUrl } from './dispatch'
import { input } from '../../utils/prompt'
import { first } from 'lodash'
import { niceToHaveSync } from '../../utils/flow-control'
import * as filenamify from 'filenamify'
import { createDownloadProgressBar } from '../common/helpers'
import { DashExecutor, DashContentType } from '../common/dash'
import { AbstractExecutor } from '../common/executor'
import { IgResponseError } from 'instagram-private-api'

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
          describe: `Specify download content, e.g. 'video,chunks,mpd,chat', defaults to 'video,chunks,mpd,chat'`,
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
          client,
        })
      },
    }
  }
}

type ContentType = (
  | 'video'
  | 'chunks'
  | 'mpd'
  | 'chat'
)

type CommonExecutionOptions = {
  readonly concurrency: number
  readonly folderPath: string
  readonly ensureUnique: boolean
  readonly contents: ReadonlySet<ContentType>
}

async function execute(options: CommonExecutionOptions & {
  readonly client: Client
  readonly broadcast: Broadcast.Broadcast
}) {
  const { folderPath, concurrency, contents, ensureUnique, broadcast, client } = options

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
    contents: toDashContent(contents),
  })

  const livechat = new LiveChat(client, broadcast.id, projectPath)

  const ids = new Set<string>()
  let progress = 0
  let total = 0

  dash.events.on('increase progress', (value, id) => {
    const oldValue = progress / ids.size || 0
    ids.add(id)
    progressBar.increaseValue((progress += value) / ids.size - oldValue)
  })

  dash.events.on('increase total', (value, id) => {
    const oldValue = total / ids.size || 0
    ids.add(id)
    progressBar.increaseTotal((total += value) / ids.size - oldValue)
  })

  progressBar.start()

  dash.start()
  livechat.start()

  await dash.exaust()

  progressBar.stop()

  await livechat.exaust()
}

class LiveChat extends AbstractExecutor {
  constructor(
    readonly client: Client,
    readonly broadcastId: string,
    readonly projectPath: string,
  ) {
    super()
  }

  protected async _execute() {
    const { client, broadcastId, projectPath } = this

    await this.untilAvailable()

    await fs.promises.mkdir(projectPath, { recursive: true })

    const logStream = fs.createWriteStream(path.join(projectPath, `logs.log`))
    const commentStream = fs.createWriteStream(path.join(projectPath, `comments.txt`))

    let lastCommentTs = 0
    let started = false

    while (true) {
      try {
        await this.untilAvailable()

        const t0 = Date.now()

        const ret = await call(async () => {
          try {
            return await client.ig.live.getComment({ broadcastId, lastCommentTs })
          } catch (e) {
            if (typeof e === 'object' && e) {
              if (e instanceof IgResponseError) {
                if (e.message.includes('deleted')) return false
              }
            }
            throw e
          }
        })
        if (!ret) {
          if (started) break
          const dt = 2000 + t0 - Date.now()
          if (dt > 0) {
            await later(dt)
          }
          continue
        }

        started = true

        const { comments } = ret
        if (comments.length) {
          for (const comment of comments) {
            niceToHaveSync(() => {
              const json = JSON.stringify(comment)
              logStream.write(json)
              logStream.write('\n')
            })
            niceToHaveSync(() => {
              const timeText = format(comment.created_at * 1000, 'HH:mm:ss')
              const msg = `${timeText}   ${comment.user.username}\n${comment.text}\n`
              commentStream.write(msg)
              commentStream.write('\n')
            })
          }
          lastCommentTs = comments[comments.length - 1].created_at
        }
        const dt = 2000 + t0 - Date.now()
        if (dt > 0) {
          await later(dt)
        }
      } catch (e) {
        console.error(e)
        await later(1000)
      }
    }
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
    if (part === 'video' || part === 'mpd' || part === 'chunks' || part === 'chat') {
      parts.push(part)
    }
  }
  if (!parts.length) {
    parts.push('video', 'chunks', 'mpd', 'chat')
  }
  return new Set(parts)
}

function getProxyFromEnv() {
  const { env } = process
  return first(['http_proxy', 'all_proxy'].map(key => env[key]).filter(Boolean))
}

function toDashContent(contents: Iterable<ContentType>): Set<DashContentType> {
  return new Set(Array.from(call(function*() {
    for (const content of contents) {
      if (content === 'chat') continue
      if (content === 'video') {
        yield 'merged'
      } else {
        yield content
      }
    }
  })))
}
