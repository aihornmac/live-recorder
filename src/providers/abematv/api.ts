import * as crypto from 'crypto'
import { get, post } from '../../utils/request'

const API_PREFIX = `https://api.abema.io/v1`

export const STREAM_DOMAIN_DS = `https://ds-vod-abematv.akamaized.net`

const MATCH_LICENSE = /^abematv-license:\/\/(.*?)$/
const MATCH_IV = /^0x((?:[a-zA-Z0-9]{2})+)$/

export function parseTicket(uri: string) {
  const match = uri.match(MATCH_LICENSE)
  if (!match) return
  return match[1]
}

export function parseIV(input: string) {
  const match = input.match(MATCH_IV)
  if (!match) return
  return match[1]
}

export async function getMediaToken(userToken: string) {
  const url = `https://api.abema.io/v1/media/token`
  const res = await get<{ token: string }>(url, {
    responseType: 'json',
    params: getFakeMobileParams(),
    headers: {
      Authorization: `Bearer ${userToken}`
    },
  })
  return res.data.token
}

export async function getHLSLicenseFromTicket(mediaToken: string, ticket: string) {
  const url = `https://license.abema.io/abematv-hls`
  const res = await post<{ k: string, cid: string }>(url, {
    kv: 'a',
    lt: ticket,
  }, {
    responseType: 'json',
    params: { t: mediaToken },
  })
  return res.data
}

const HKEY = Buffer.from('3AF0298C219469522A313570E8583005A642E73EDD58E3EA2FB7339D3DF1597E', 'hex')

const SECRET_KEY = Buffer.from(
  "v+Gjs=25Aw5erR!J8ZuvRrCx*rGswhB&qdHd_SYerEWdU&a?3DzN9B" +
  "Rbp5KwY4hEmcj5#fykMjJ=AuWz5GSMY-d@H7DMEh3M@9n2G552Us$$" +
  "k9cD=3TxwWe86!x#Zyhe",
  'utf8'
)

const LICENSE_CHAR_INDEX_MAP = (
  `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`
    .split('')
    .reduce<{ [key: string]: number }>((m, x, i) => (m[x] = i, m), {})
)

export function readEncodedVideoKey(k: string) {
  const { length } = k
  let s = BigInt(0)
  for (let i = 0; i < length; i++) {
    s += BigInt(LICENSE_CHAR_INDEX_MAP[k[i]]) * BigInt(58) ** BigInt(length - 1 - i)
  }
  return bigintToBuffer(s)
}

export function getVideoKeyFromHLSLicense(
  deviceId: string,
  cid: string,
  encodedVideoKey: Buffer,
) {
  const encodedKey = sha256(HKEY, cid + deviceId)
  const aes = crypto.createDecipheriv('aes-256-ecb', encodedKey, null)
  aes.setAutoPadding(false)
  return Buffer.concat([aes.update(encodedVideoKey), aes.final()])
}

export async function createUser(deviceId: string) {
  const url = `${API_PREFIX}/users`
  const applicationKeySecret = generateApplicationKeySecret(deviceId)
  const res = await post<{
    token: string
    profile: {
      userId: string
    }
  }>(url, {
    deviceId,
    applicationKeySecret,
  }, {
    responseType: 'json',
    headers: {
      "Content-Type": "application/json",
    }
  })
  return res.data
}

export function generateApplicationKeySecret(deviceId: string) {
  // get next hour start timestamp in second
  const time = Math.floor(Date.now() / 3600000 + 1) * 3600
  const date = new Date(time * 1000)

  let cipher = sha256(SECRET_KEY, SECRET_KEY)

  loop(date.getUTCMonth() + 1)

  add(deviceId)

  loop(date.getUTCDate() % 5)

  add(String(time))

  loop(date.getUTCHours() % 5)

  return encodeBase64(cipher.toString('base64'))

  function loop(times: number) {
    for (let i = 0; i < times; i++) {
      cipher = sha256(SECRET_KEY, cipher)
    }
  }

  function add(str: string) {
    cipher = sha256(SECRET_KEY, encodeBase64(cipher.toString('base64')) + str)
  }
}

export async function getSlotInfo(userToken: string, slotId: string) {
  const url = `${API_PREFIX}/media/slots/${slotId}`
  const res = await get<{
    slot: {
      id: string
      title: string
      /**
       * in seconds
       */
      startAt: number
      /**
       * in seconds
       */
      endAt: number
    }
  }>(url, {
    responseType: 'json',
    headers: {
      Authorization: `Bearer ${userToken}`
    },
  })
  return res.data.slot
}

export async function getSlotVodPlaylist(slotId: string) {
  const url = `${STREAM_DOMAIN_DS}/slot/${slotId}/playlist.m3u8`
  const res = await get<string>(url, { responseType: 'text' })
  return {
    domain: STREAM_DOMAIN_DS,
    url,
    content: res.data,
  }
}

export async function getSlotChasePlaylist(slotId: string, mediaToken: string) {
  const url = `${STREAM_DOMAIN_DS}/chase/slot/${slotId}/playlist.m3u8`
  const res = await get<string>(url, {
    responseType: 'text',
    params: { t: mediaToken },
  })
  return {
    domain: STREAM_DOMAIN_DS,
    url,
    content: res.data,
  }
}

function sha256(key: crypto.BinaryLike | crypto.KeyObject, data: crypto.BinaryLike) {
  return crypto.createHmac('sha256', key).update(data).digest()
}

function encodeBase64(base64: string) {
  return makeBase64Safe(base64.replace(/=+$/, ''))
}

function makeBase64Safe(base64: string) {
  let s = ''
  for (const char of base64) {
    if (char === '+') {
      s += '-'
    } else if (char === '/') {
      s += '_'
    } else {
      s += char
    }
  }
  return s
}

function bigintToBuffer(value: bigint) {
  const str = value.toString(16)
  return Buffer.from(str.length % 2 ? ('0' + str) : str, 'hex')
}

function getFakeMobileParams() {
  return {
    osName: 'android',
    osVersion: '6.0.1',
    osLang: 'ja_JP',
    osTimezone: 'Asia/Tokyo',
    appId: 'tv.abema',
    appVersion: '3.27.1',
  }
}
