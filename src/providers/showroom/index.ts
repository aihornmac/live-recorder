import * as path from 'path'
import * as chalk from 'chalk'
import format from 'date-fns/format'

import { parseUrl, getRoomIdByRoomUrlKey, getStreamingUrl, getRoomInfoByRoomId } from './api'
import { HLSProject } from '../common/project'
import { CommonCreateOptions } from '../common/typed-input'
import { fail } from '../../utils/error'

export function create(url: string, options: CommonCreateOptions) {
  const info = parseUrl(url)
  if (info.kind === 'error') return info
  return async function execute() {
    console.log(`showroom url key ${info.data.name}`)
    const roomId = await getRoomIdByRoomUrlKey(info.data.name)
    if (typeof roomId === 'undefined') {
      throw fail(chalk.yellowBright(`room ${info.data.name} doesn't exist`))
    }
    const roomInfoPromise = getRoomInfoByRoomId(roomId)
    // loop in case of broken stream
    while (true) {
      const [roomInfo, streamingUrl] = await Promise.all([
        roomInfoPromise,
        getStreamingUrl(roomId),
      ])
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
      console.log(`stream playlist ${streamingUrl}`)
      const project = new HLSProject(streamingUrl, projectPath)
      await project.handover()
    }
  }
}
