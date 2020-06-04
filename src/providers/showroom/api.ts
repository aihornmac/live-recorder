import { URL } from 'url'

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
  const fakeMobileHeader = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Charset': 'UTF-8,*;q=0.5',
    'Accept-Encoding': 'gzip,deflate,sdch',
    'Accept-Language': 'en-US,en;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 4.4.2; Nexus 4 Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.114 Mobile Safari/537.36',
  }
  return ensure(async () => {
    const res = await get<string>(url, {
      headers: fakeMobileHeader,
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

export async function getStreamingUrl(roomId: number) {
  return ensure(async () => {
    const url = `https://www.showroom-live.com/api/live/streaming_url?room_id=${roomId}&_=${Date.now()}`
    const res = await get<GetStreamingUrlListResponse>(url, { responseType: 'json' })
    const json = res.data
    // when live is not open, it returns {}
    // when live is open, it returns sth like
    // {
    //   "streaming_url_list": [
    //     {
    //       "url": "rtmp://52.197.69.198:1935/liveedge",
    //       "id": 1,
    //       "label": "original spec(low latency)",
    //       "is_default": true,
    //       "type": "rtmp",
    //       "stream_name": "7656a6d5baa1d77075c971f6d8b6dc61b979fc913dc5fe7cc1318281793436ed"
    //     },
    //     {
    //       "url": "http://52.197.69.198:1935/liveedge/7656a6d5baa1d77075c971f6d8b6dc61b979fc913dc5fe7cc1318281793436ed/playlist.m3u8",
    //       "is_default": true,
    //       "id": 2,
    //       "type": "hls",
    //       "label": "original spec"
    //     },
    //     {
    //       "url": "rtmp://52.197.69.198:1935/liveedge",
    //       "id": 3,
    //       "label": "low spec(low latency)",
    //       "is_default": false,
    //       "type": "rtmp",
    //       "stream_name": "7656a6d5baa1d77075c971f6d8b6dc61b979fc913dc5fe7cc1318281793436ed_low"
    //     },
    //     {
    //       "url": "http://52.197.69.198:1935/liveedge/7656a6d5baa1d77075c971f6d8b6dc61b979fc913dc5fe7cc1318281793436ed_low/playlist.m3u8",
    //       "is_default": false,
    //       "id": 4,
    //       "type": "hls",
    //       "label": "low spec"
    //     }
    //   ]
    // }
    const list = json.streaming_url_list
    if (!list) {
      await later(1000)
      throw fail(`live offline`, `Live is not started`)
    }
    // only takes http live streaming
    const hlsList = list.filter((x): x is Extract<typeof x, { type: 'hls' }> => x.type === 'hls')
    if (!hlsList.length) {
      await later(1000)
      throw fail(`no hls found`)
    }
    const hls = (
      hlsList.find(x => x.label.includes('original')) ||
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
