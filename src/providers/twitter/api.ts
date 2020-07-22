import { stringifyCookie, parseCookie } from '../../utils/cookie'
import { get, post } from '../../utils/request'
import { call } from '../../utils/js'

const API_PREFIX = `https://api.twitter.com/1.1`

const TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

export class Client {
  guestId = ''
  guestToken = ''
  cookie: { readonly [key: string]: string } = {}

  getHeaders() {
    return {
      Authorization: `Bearer ${TOKEN}`,
      'Cookie': stringifyCookie(this.cookie),
      'Origin': 'https://twitter.com',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
      'x-guest-token': this.guestToken,
    }
  }
}

export async function createClient() {
  const res = await get(`https://twitter.com`)
  const client = new Client()
  const cookie: { [key: string]: string } = {}
  const cookieText = res.headers['set-cookie']
  if (cookieText) {
    for (const item of Array.isArray(cookieText) ? cookieText : [cookieText]) {
      Object.assign(cookie, parseCookie(item))
    }
  }
  const guestId = call(() => {
    if (cookie.guest_id) {
      const match = decodeURIComponent(cookie.guest_id).match(/([0-9]+?)$/)
      if (match) return match[1]
    }
    return ''
  })
  const guestToken = await getGuestToken(client)
  client.cookie = cookie
  client.guestId = guestId
  client.guestToken = guestToken
  return client
}

async function getGuestToken(client: Client) {
  const url = `${API_PREFIX}/guest/activate.json`
  const res = await post<{
    guest_token: string
  }>(url, undefined, {
    responseType: 'json',
    headers: client.getHeaders(),
  })
  return res.data.guest_token
}

export async function getStreamData(client: Client, id: number | BigInt | string) {
  const url = `${API_PREFIX}/videos/tweet/config/${id}.json`
  const res = await get<{
    track: {
      contentType: string
      publisherId: string
      contentId: string
      durationMs: number
      playbackUrl: string
      playbackType: string
      expandedUrl: string
      vmapUrl: null
      cta: null
      shouldLoop: boolean
      viewCount: string
      isEventGeoblocked: boolean
      is360: boolean
      mediaAvailability: {
        status: string
        reason: string | null
      }
    }
    posterImage: string
    features: {
      isEdgeEnabled: boolean
      bitrateCap: null
      isDebuggingEnabled: boolean
      fatalErrorRetryMax: number
      isLiveTimecodeEnabled: boolean
      isClientMediaEventScribingEnabled: boolean
    }
    translations: { [key: string]: string }
  }>(url, {
    responseType: 'json',
    headers: client.getHeaders(),
  })
  return res.data
}
