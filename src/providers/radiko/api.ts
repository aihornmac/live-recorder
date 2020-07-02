import { add } from 'date-fns'
import * as qs from 'qs'

import { post, get } from '../../utils/request'
import { once, stripUndefined } from '../../utils/js'
import { ensure } from '../../utils/flow-control'
import { swfExtract } from './swfextract'
import { fail } from '../../utils/error'
import { generateGPSInfo, parseXML } from './helpers'
import { mergeCookie } from '../../utils/cookie'

const API_PREFIX = 'https://radiko.jp'

export class Client {
  token = ''
  cookie = ''
  user?: {
    userKey: string
    isPaidMember: boolean
    isAreaFree: boolean
  }
  private _areaId = ''
  private _location?: string

  get areaId() {
    return this._areaId
  }

  set areaId(areaId) {
    this._areaId = areaId
    this._location = generateGPSInfo(areaId)
  }

  getHeaders() {
    return getHeaders({
      location: this._location || undefined,
      token: this.token || undefined,
      cookie: this.cookie || undefined,
    })
  }
}

export async function createClient(options?: {
  readonly login?: {
    readonly mail: string
    readonly password: string
  }
  readonly areaId?: string
}) {
  if (!options) options = {}
  const client = new Client()
  if (options.login) {
    const { mail, password } = options.login
    const cookie = await login(mail, password)
    const result = await loginCheck(cookie)
    if (result.status !== '200') {
      throw new Error(`Failed to login: ${result.status} ${result.message} ${result.cause}`)
    }
    client.cookie = cookie
    client.user = {
      userKey: result.user_key,
      isPaidMember: Boolean(+result.paid_member),
      isAreaFree: Boolean(+result.areafree),
    }
  }
  if (options.areaId) {
    client.areaId = options.areaId
  } else {
    client.areaId = await getAreaId()
  }
  client.token = await getAuthToken(client)
  return client
}

export async function getAreaId() {
  const url = `${API_PREFIX}/area`
  const res = await get<string>(url, {
    responseType: 'text',
  })
  const script = res.data
  const match = script.match(/(JP\d+?)\b/)
  if (!match) throw fail(`Unable to parse area id from ${script}`)
  return match[1]
}

export async function getStationList(client: Client) {
  const url = `${API_PREFIX}/v3/station/list/${client.areaId}.xml`
  const res = await get<string>(url, {
    responseType: 'text',
    headers: client.getHeaders(),
  })
  const xml = res.data
  const data = parseXML(xml) as {
    stations: {
      station: Array<{
        id: string
        name: string
        ascii_name: string
        ruby: string
        areafree: number
        timefree: number
        logo: string[]
        banner: string
        href: string
        tf_max_delay: number
      }>
    }
  }
  return data.stations.station
}

/**
 * get station list of certain date
 * @param date number like yyyymmdd e.g. 20200701
 * @param areaId
 */
export async function getStationListByDate(client: Client, date: number) {
  const url = `${API_PREFIX}/v3/program/date/${date}/${client.areaId}.xml`
  const res = await get<string>(url, {
    responseType: 'text',
    headers: client.getHeaders(),
  })
  const xml = res.data
  const data = parseXML<{
    radiko: {
      ttl: number
      srvtime: number
      stations: {
        station: Array<{
          "@_id": string
          name: string
          progs: {
            date: number
            prog: Array<{
              "@_id": string
              "@_master_id": string
              "@_ft": string
              "@_to": string
              "@_ftl": string
              "@_tol": string
              "@_dur": string
              title: string
              url: string
              failed_record: number
              ts_in_ng: number
              ts_out_ng: number
              desc: string
              info: string
              pfm: string
              img: string
              metas: {
                meta: {
                  "@_name": string
                  "@_value": string
                } | Array<{
                  "@_name": string
                  "@_value": string
                }>
              }
            }>
          }
        }>
      }
    }
  }>(xml)
  return data.radiko
}

/**
 * get program of station given start time
 */
export async function getProgramByStartTime(client: Client, options: {
  readonly stationId: string
  readonly startTime: number
}) {
  const { stationId, startTime } = options
  const startTimestamp = parseProgramSecond(startTime)
  const date = +getProgramDate(startTimestamp)
  const ret = await getStationListByDate(client, date)
  for (const station of ret.stations.station) {
    if (station['@_id'] !== stationId) continue
    for (const program of station.progs.prog) {
      const from = +program['@_ft']
      const to = +program['@_to']
      if (startTime >= from  && startTime < to) {
        return program
      }
    }
  }
  return undefined
}

/**
 * get m3u8 playlist of program
 * @param token
 * @param stationId LFR
 * @param fromTime e.g. 20200702010000
 * @param toTime e.g. 20200702030000
 */
export async function getProgramStreamList(client: Client, options: {
  readonly stationId: string
  readonly fromTime: number
  readonly toTime: number
}) {
  const { stationId, fromTime, toTime } = options
  const url = getProgramStreamListUrl()
  const res = await post<string>(url, undefined, {
    params: {
      station_id: stationId,
      ft: fromTime,
      to: toTime,
    },
    headers: client.getHeaders(),
  })
  return res.data
}

export function getProgramStreamListUrl() {
  return getAPIUrl(`/ts/playlist.m3u8`)
}

export async function getAuthToken(client: Client) {
  const [playerBuffer, { token, keyOffset, keyLength }] = await Promise.all([
    getPlayerBuffer(),
    auth1(client),
  ])
  const partialKey = await getPartialKey(playerBuffer, keyOffset, keyLength)
  const ret = await auth2(client, token, partialKey)
  verifyAuth2Response(ret)
  return token
}

/**
 * login with account and return cookie
 * @param mail
 * @param password
 */
export async function login(mail: string, password: string) {
  const url = `${API_PREFIX}/ap/member/login/login`
  const res = await post<string>(url, qs.stringify({
    mail,
    pass: password,
  }), {
    responseType: 'text',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    maxRedirects: 0,
    validateStatus: status => status >= 200 && status < 400,
  })
  const headers: Headers = res.headers
  const cookie = headers['set-cookie']
  if (!cookie) return ''
  return mergeCookie(Array.isArray(cookie) ? cookie : [cookie])
}

export async function loginCheck(cookie: string) {
  const url = `${API_PREFIX}/ap/member/webapi/member/login/check`
  const res = await get<{
    status: '200'
    user_key: string
    areafree: string
    paid_member: string
  } | {
    status: '400'
    cause: string
    message: string
  }>(url, {
    headers: {
      Cookie: cookie,
    },
    validateStatus: () => true,
  })
  return res.data
}

export function getProgramDate(timestamp: number | Date) {
  const date = add(timestamp, { hours: 5 })
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  return `${year}${[month, day].map(x => padLeft(String(x), '00')).join('')}`
}

export function getProgramSecond(timestamp: number | Date) {
  const date = add(timestamp, { hours: 9 })
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()
  const second = date.getUTCSeconds()
  return `${year}${[month, day, hour, minute, second].map(x => padLeft(String(x), '00')).join('')}`
}

const MATCH_PROGRAM_SECOND = new RegExp(`^(?<years>[0-9]+)${
  ['months', 'days', 'hours', 'minutes', 'seconds'].map(name => `(?<${name}>[0-9]{2})`).join('')
}$`)

export function parseProgramSecond(time: number | string) {
  const match = String(time).match(MATCH_PROGRAM_SECOND)
  if (!match) throw fail(`Unable to parse program second, ${time}`)
  const years = +match.groups!.years
  const months = +match.groups!.months
  const days = +match.groups!.days
  const hours = +match.groups!.hours
  const minutes = +match.groups!.minutes
  const seconds = +match.groups!.seconds
  return add(
    new Date(years, months - 1, days, hours, minutes, seconds),
    // move to +09:00 timezone
    { minutes: -(540 + new Date().getTimezoneOffset()) }
  )
}

/**
 * get token, keyOffset, keyLength
 */
async function auth1(client: Client) {
  const url = getAPIUrl(`/auth1`)
  const res = await post<unknown>(url, undefined, {
    headers: client.getHeaders(),
  })
  const headers: Headers = res.headers
  return {
    token: String(headers['x-radiko-authtoken']),
    keyOffset: parseInt(String(headers['x-radiko-keyoffset']), 10),
    keyLength: parseInt(String(headers['x-radiko-keylength']), 10),
  }
}

async function getPartialKey(playerBuffer: Buffer, offset: number, length: number) {
  const buf = await swfExtract(playerBuffer)
  return buf.slice(offset, offset + length).toString('base64')
}

/**
 * enables the given token
 */
async function auth2(client: Client, token: string, partialKey: string) {
  const url = getAPIUrl(`/auth2`) 
  const res = await get<string>(url, {
    headers: {
      ...client.getHeaders(),
      'X-Radiko-Authtoken': token,
      'X-Radiko-Partialkey': partialKey,
    },
  })
  return res.data
}

function verifyAuth2Response(text: string) {
  if (!text) {
    throw fail('Missing Token')
  }
  if (!text.trim().startsWith('JP')) {
    throw fail(`Invalid Token, got ${text}`)
  }
}

const getPlayerBuffer = once(() => ensure(async () => {
  const res = await get<Buffer>(`${API_PREFIX}/apps/js/flash/myplayer-release.swf`, {
    responseType: 'arraybuffer'
  })
  return res.data
}))

function getAPIUrl(uri: string, version: 'v2' | 'v3' = 'v2') {
  return `${API_PREFIX}/${version}/api${uri}`
}

function getHeaders(options?: {
  readonly token?: string
  readonly cookie?: string
  readonly location?: string
}) {
  if (!options) options = {}
  return stripUndefined({
    Host: 'radiko.jp',
    Pragma: 'no-cache',
    'X-Radiko-App': 'pc_ts',
    'X-Radiko-App-Version': '4.0.0',
    'X-Radiko-User': 'test-stream',
    'X-Radiko-Device': 'pc',
    'X-Radiko-AuthToken': options.token,
    'X-Radiko-Location': options.location,
    'Cookie': options.cookie,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36',
  })
}

function padLeft(input: string, padding: string) {
  return (padding + input).slice(-padding.length)
}

type Headers = { readonly [key: string]: string | string[] }
