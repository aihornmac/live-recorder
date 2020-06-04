import * as path from 'path'
import * as fs from 'fs'
import format from 'date-fns/format'
import * as chalk from 'chalk'

import { parseUrl, getRoomIdByRoomUrlKey, getStreamingUrl, getRoomInfoByRoomId, getHeuristicChunkUrl, getRoomLiveInfo, RoomInfo } from './api'
import { HLSProject } from '../common/project'
import { CommonCreateOptions } from '../common/typed-input'
import { fail } from '../../utils/error'
import { ShowroomLiveChat } from './live-chat'

export function match(url: string, options: CommonCreateOptions) {
  const info = parseUrl(url)
  if (info.kind === 'error') return info

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
      (() => {
        if (roomInfo) {
          const name = roomInfo.room_name || roomInfo.main_name
          if (name) return name
        }
        return info.data.name
      })(),
      format(new Date(), 'yyyyLLddHHmmss'),
    )
    console.log(`writing to ${projectPath}`)
    return projectPath
  }

  return {
    async video() {
      const roomId = await getRoomId()
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
    },
    async livechat() {
      const roomId = await getRoomId()
      const info = await getRoomLiveInfo(roomId)
      const host = info.bcsvr_host
      const port = info.bcsvr_port
      const key = info.bcsvr_key
      const roomInfo = await getRoomInfoByRoomId(roomId)
      const projectPath = getProjectPath(roomInfo)
      await fs.promises.mkdir(projectPath, { recursive: true })
      const logPath = path.join(projectPath, 'logs.log')
      const writeStream = fs.createWriteStream(logPath, { flags: 'a+' })
      // loop in case of broken stream
      while (true) {
        console.log(`connecting to ws://${host}:${port} with key ${key}`)
        const livechat = new ShowroomLiveChat(host, port, key)
        livechat.on('event', payload => {
          writeStream.write(JSON.stringify(payload))
          writeStream.write('\n')
        })
        await livechat.exaust()
      }
    },
  }
}
