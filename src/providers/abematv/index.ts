import * as path from 'path'
import * as fs from 'fs'
import * as yargs from 'yargs'
import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'
import { URL } from 'url'

import { CommonCreateOptions, CommonArgv } from '../common/typed-input'
import { M3UReader, parseProperties } from '../../utils/m3u'
import { readlineFromBuffer } from '../../utils/readline'
import { call, createSequancePromise } from '../../utils/js'
import { createUser, parseTicket, parseIV, getMediaToken, getHLSLicenseFromTicket, readEncodedVideoKey, getVideoKeyFromHLSLicense, getSlotVodPlaylist, getSlotInfo, getSlotChasePlaylist } from './api'
import { PipeStream } from '../../utils/stream'
import { ensure } from '../../utils/flow-control'
import { get } from '../../utils/request'
import { parseUrl } from './dispatch'
import { fail } from '../../utils/error'
import * as chalk from 'chalk'

const DEFAULT_CONCURRENT = 8

export interface Argv {
  concurrent?: number
  token?: string
}

export function match(url: string) {
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

        const { deviceId, usertoken } = await call(async () => {
          const { token } = argv
          if (token) {
            const data: { dev: string } = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'))
            return { usertoken: token, deviceId: data.dev }
          } else {
            const deviceId = uuidv4()
            const { token: usertoken } = await createUser(deviceId)
            return { usertoken, deviceId }
          }
        })

        const { title, getPlayList } = await call(async () => {
          const { type, id } = info.data

          if (type === 'slot') {
            const slotInfo = await ensure(() => getSlotInfo(usertoken, id))
            return {
              title: slotInfo.title,
              getPlayList: await call(async () => {
                if (slotInfo.endAt * 1000 > Date.now()) {
                  // when slot is not ended, can only get chase list
                  const mediaToken = await getMediaToken(usertoken)
                  return () => getSlotChasePlaylist(id, mediaToken)
                } else {
                  return () => getSlotVodPlaylist(id)
                }
              }),
            }
          }

          throw fail(`unsupported type ${type}`)
        })

        const projectPath = call(() => {
          const root = path.resolve(process.cwd(), options.projectPath || '')
          return path.join(root, (title ? title + '.' : '') + format(new Date(), 'yyyyLLddHHmmss'))
        })

        console.log(`writing to ${projectPath}`)

        await fs.promises.mkdir(projectPath, { recursive: true })

        yield 'prepared' as const

        const { domain, url: playlistChoicesUrl, content: playlistChoices } = await getPlayList()

        const choices: Array<{
          url: string
          bandwidth: number
          resolution?: {
            width: number
            height: number
          }
        }> = []

        {
          const reader = new M3UReader()

          for await (const line of readlineFromBuffer(playlistChoices)) {
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

        const pickedPlaylistUrl = call(() => {
          const u = new URL(playlistChoicesUrl)
          const [uri, query] = pickedChoice.url.split('?')
          u.pathname = path.dirname(u.pathname) + '/' + uri
          u.search = query
          return u.toString()
        })

        console.log()

        console.log(`using manifest: ${pickedPlaylistUrl}`)

        console.log()

        const playlist = await ensure(async () => {
          const res = await get<string>(pickedPlaylistUrl, { responseType: 'text' })
          return res.data
        })

        const reader = new M3UReader()

        for await (const line of readlineFromBuffer(playlist)) {
          reader.push(line)
        }

        let decoder = defaultDecoder

        let timeoffset = 0

        const concurrent = new PipeStream<void>()
        for (let i = 0; i < concurrency; i++) {
          concurrent.write()
        }

        const writeSequence = createSequancePromise()

        const writeStream = fs.createWriteStream(path.join(projectPath, 'download.mp4'))

        for (const action of reader.actions) {
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
            const currentTimeoffset = timeoffset
            timeoffset += action.duration
            const currentDecoder = decoder

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
              console.log(currentTimeoffset)
            })
          }
        }
      },
    }
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
