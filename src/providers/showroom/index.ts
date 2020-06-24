import * as path from 'path'
import * as fs from 'fs'
import { URL } from 'url'
import { format } from 'date-fns'
import * as chalk from 'chalk'
import * as filenamify from 'filenamify'

import { parseUrl, getRoomIdByRoomUrlKey, getStreamingUrl, getRoomInfoByRoomId, getHeuristicChunkUrl, getRoomLiveInfo, RoomInfo } from './api'
import { HLSProject } from '../common/project'
import { CommonCreateOptions, CommonArgv } from '../common/typed-input'
import { fail } from '../../utils/error'
import { ShowroomLiveChat } from './live-chat'
import { ensure, niceToHave } from '../../utils/flow-control'
import { later } from '../../utils/js'
import * as yargs from 'yargs'

export function match(url: URL) {
  const info = parseUrl(url)
  if (info.kind === 'error') return info

  return (yargs: yargs.Argv<CommonArgv>) => {
    const argv = (
      yargs
        .option('type', {
          type: 'string',
          nargs: 1,
          demandOption: false,
          describe: 'Specify record type. e.g. video / livechat',
        })
        .parse()
    )

    return {
      argv() {
        return argv
      },
      execute(options: CommonCreateOptions) {
        const { type } = argv

        const getRoomId = async () => {
          console.log(`showroom url key ${info.data.name}`)
          const roomId = await getRoomIdByRoomUrlKey(info.data.name)
          if (typeof roomId === 'undefined') {
            throw fail(chalk.yellowBright(`room ${info.data.name} doesn't exist`))
          }
          console.log(`room id ${roomId}`)
          return roomId
        }

        const getProjectPath = (roomInfo?: RoomInfo | void) => {
          const projectPath = options.projectPath || path.join(
            filenamify((() => {
              if (roomInfo) {
                const name = roomInfo.room_name || roomInfo.main_name
                if (name) return name
              }
              return info.data.name
            })(), { replacement: '-' }),
            format(new Date(), 'yyyyLLddHHmmss'),
          )
          console.log(`writing to ${projectPath}`)
          return projectPath
        }

        if (type === 'livechat') return livechat()
        return video()

        async function * video() {
          const roomId = await getRoomId()
          yield 'prepared' as const
          const roomInfoPromise = getRoomInfoByRoomId(roomId)
          // loop in case of broken stream
          while (true) {
            const [roomInfo, streamingUrl] = await Promise.all([
              roomInfoPromise,
              getStreamingUrl(roomId),
            ])
            const projectPath = getProjectPath(roomInfo)
            console.log(`stream playlist ${streamingUrl}`)
            const project = new HLSProject(streamingUrl, projectPath, {
              getHeuristicChunkUrl,
            })
            const state = await project.handover()
            if (state === 'stopped') return
          }
        }

        async function * livechat() {
          const roomId = await getRoomId()
          yield 'prepared' as const
          const info = await ensure(async () => {
            const t0 = Date.now()
            const ret = await getRoomLiveInfo(roomId)
            if (!ret.bcsvr_key) {
              const dt = Date.now() - t0
              await later(Math.max(0, 2000 - dt))
              throw fail(`Live Chat is not started`)
            }
            return ret
          })
          const host = info.bcsvr_host
          const port = info.bcsvr_port
          const key = info.bcsvr_key
          const roomInfo = await getRoomInfoByRoomId(roomId)
          const projectPath = getProjectPath(roomInfo)
          await fs.promises.mkdir(projectPath, { recursive: true })
          const logPath = path.join(projectPath, 'logs.log')
          const commentsPath = path.join(projectPath, 'comments.txt')
          const logStream = fs.createWriteStream(logPath, { flags: 'a+' })
          const commentsStream = fs.createWriteStream(commentsPath, { flags: 'a+' })
          console.log(`connecting to ws://${host}:${port} with key ${key}`)
          const livechat = new ShowroomLiveChat(host, port, key)
          livechat.on('event', payload => {
            niceToHave(() => {
              logStream.write(JSON.stringify(payload))
              logStream.write('\n')
            })
            niceToHave(() => {
              if (payload.t === '1') {
                const timeText = format(payload.created_at * 1000, 'HH:mm:ss')
                const msg = `${timeText}   ${payload.ac}\n${payload.cm}\n`
                commentsStream.write(msg)
                commentsStream.write('\n')
              }
            })
          })
          await livechat.exaust()
        }
      }
    }
  }
}
