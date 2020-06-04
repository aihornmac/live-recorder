import { URL, format } from 'url'
import * as path from 'path'

import {
  failProviderMismatch,
  failProviderInvalid,
  createProviderInfo,
} from '../common/typed-input'
import { ensure, niceToHave } from '../../utils/flow-control'
import { fail } from '../../utils/error'
import { get } from '../../utils/request'
import { later } from '../../utils/js'

export interface ParsedShowroomInfo {
  name: string
}

export function parseUrl(url: string) {
  const op = new URL(url)

  if (op.hostname !== 'showroom-live.com' && op.hostname !== 'www.showroom-live.com') {
    return failProviderMismatch('showroom')
  }

  if (op.hostname !== op.host) {
    return failProviderInvalid('showroom', `port is not empty in host, ${JSON.stringify(op.port)} given`)
  }

  const inputRoomUrlKey = op.pathname.slice(1)
  const matchRoomUrlKey = inputRoomUrlKey.match(/^[-\w]+$/)
  if (!matchRoomUrlKey) {
    return failProviderInvalid('showroom', `room name is not valid, ${JSON.stringify(inputRoomUrlKey)} given`)
  }

  const roomUrlKey = matchRoomUrlKey[0]

  return createProviderInfo<'showroom', ParsedShowroomInfo>('showroom', {
    name: roomUrlKey,
  })
}

export interface RoomInfo {
  main_name: string
  live_id: number
  is_onlive: boolean
  room_id: number
  room_name: string
  room_url_key: number
}

export async function getRoomInfoByRoomId(roomId: number) {
  const url = `https://www.showroom-live.com/api/room/profile?room_id=${roomId}`
  return niceToHave(async () => {
    const res = await get<RoomInfo>(url, { responseType: 'json' })
    return res.data
  })
}

export async function getRoomIdByRoomUrlKey(name: string) {
  const url = `https://www.showroom-live.com/${name}`
  return ensure(async () => {
    const res = await get<string>(url, {
      headers: getFakeMobileHeaders(),
      responseType: 'text',
      validateStatus(status) {
        return status >= 200 && status < 300 || status === 404
      },
    })
    if (res.status === 404) return
    const html = res.data
    const matchId = html.match(/room\?room_id\=(\d+)/)
    if (!matchId) {
      throw new Error(`Can't find id in showroom page ${url}`)
    }
    return +matchId[1]
  })
}

export async function getRoomLiveInfo(roomId: number) {
  const url = `https://www.showroom-live.com/api/live/live_info?room_id=${roomId}`
  return ensure(async () => {
    const res = await get<RoomLiveInfo>(url, {
      headers: getFakeMobileHeaders(),
      responseType: 'json',
    })
    // {
    //   "enquete_gift_num": 0,
    //   "is_enquete": false,
    //   "live_id": 9833971,
    //   "is_enquete_result": false,
    //   "room_name": "マクロスがとまらない",
    //   "background_image_url": null,
    //   "age_verification_status": 0,
    //   "bcsvr_port": 8080,
    //   "video_type": 0,
    //   "live_type": 0,
    //   "is_free_gift_only": true,
    //   "premium_room_type": 0,
    //   "bcsvr_host": "online.showroom-live.com",
    //   "bcsvr_key": "960df3:xzRiR62X",
    //   "room_id": 86535,
    //   "live_status": 2
    // }
    return res.data
  })
}

interface RoomLiveInfo {
  enquete_gift_num: number
  is_enquete: boolean
  live_id: number
  is_enquete_result: boolean
  room_name: string
  background_image_url: string | null
  age_verification_status: number
  bcsvr_port: number
  video_type: number
  live_type: number
  is_free_gift_only: boolean
  premium_room_type: number
  bcsvr_host: string
  bcsvr_key: string
  room_id: number
  live_status: number
}

export async function getStreamingUrl(roomId: number) {
  return ensure(async () => {
    const t0 = Date.now()
    const url = `https://www.showroom-live.com/api/live/streaming_url?room_id=${roomId}&_=${Date.now()}`
    const res = await get<GetStreamingUrlListResponse>(url, { responseType: 'json' })
    const json = res.data
    // when live is not open, it returns {}
    // when live is open, it returns sth like
    // {
    //   "streaming_url_list": [
    //     {
    //       "is_default": true,
    //       "url": "https://hls-origin254.showroom-cdn.com/liveedge/efdfd415d5a32b7d6fbdad941a001fc31966e7468468e5439269b9c7d27b601e/chunklist.m3u8",
    //       "type": "hls",
    //       "id": 2,
    //       "label": "普通規格",
    //       "quality": 1500
    //     },
    //     {
    //       "is_default": false,
    //       "url": "https://hls-origin254.showroom-cdn.com/liveedge/efdfd415d5a32b7d6fbdad941a001fc31966e7468468e5439269b9c7d27b601e_low/chunklist.m3u8",
    //       "type": "hls",
    //       "id": 4,
    //       "label": "低規格",
    //       "quality": 150
    //     }
    //   ]
    // }
    const list = json.streaming_url_list
    if (!list) {
      const dt = Date.now() - t0
      await later(Math.max(0, 2000 - dt))
      throw fail(`Live is not started`)
    }
    // only takes http live streaming
    const hlsList = list.filter((x): x is Extract<typeof x, { type: 'hls' }> => x.type === 'hls')
    if (!hlsList.length) {
      await later(1000)
      throw fail(`no hls found`)
    }
    const hls = (
      hlsList.find(x => x.is_default) ||
      hlsList.slice()
        .filter(x => typeof x.quality === 'number')
        .sort((a, b) => b.quality - a.quality)[0] ||
      hlsList[0]
    )
    return hls.url
  })
}

type GetStreamingUrlListResponse = (
  | { streaming_url_list: undefined }
  | GetStreamingUrlListSuccessResponse
)

interface GetStreamingUrlListSuccessResponse {
  streaming_url_list: Array<{
    url: string
    id: number
    label: string
    is_default: boolean
    type: 'rtmp'
    stream_name: string
  } | {
    id: number
    is_default: boolean
    label: string
    quality: number
    type: 'hls'
    url: string
  }>
}

export function getHeuristicChunkUrl(sampleChunkId: number, sampleChunkUrl: string) {
  const u = new URL(sampleChunkUrl)
  const sampleChunkFileName = path.basename(u.pathname)
  u.pathname = path.dirname(u.pathname)
  const directory = format(u)
  return function getById(id: number) {
    if (id === sampleChunkId) return sampleChunkUrl
    const newFileName = sampleChunkFileName.replace(String(sampleChunkId), String(id))
    if (newFileName === sampleChunkFileName) {
      throw fail(`Failed to get heuristic chunk url of ${id} given chunk ${sampleChunkId} ${sampleChunkUrl}`)
    }
    const newUrl = new URL(directory)
    newUrl.pathname += `/${newFileName}`
    return format(newUrl)
  }
}

function getFakeMobileHeaders() {
  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Charset': 'UTF-8,*;q=0.5',
    'Accept-Encoding': 'gzip,deflate,sdch',
    'Accept-Language': 'en-US,en;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 4.4.2; Nexus 4 Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.114 Mobile Safari/537.36',
  }
}
