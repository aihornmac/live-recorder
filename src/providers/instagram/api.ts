import { IgApiClient, IgLoginTwoFactorRequiredError, IgLoginBadPasswordError } from 'instagram-private-api'
import { once } from 'lodash'
import * as fs from 'fs'
import * as path from 'path'
import { URL } from 'url'
import * as chalk from 'chalk'
import * as shttps from 'socks-proxy-agent'
import { LocalStorage } from '../common/localstorage'
import { exists } from '../../utils/fs'
import { password, input } from '../../utils/prompt'
import { call } from '../../utils/js'

export const PROVIDER = 'instagram'

export interface Config {
  readonly username?: string
}

export const getLocalStorage = once(() => new LocalStorage<Config>(PROVIDER))

class Client {
  constructor(
    readonly ig: IgApiClient,
  ) {}
}

export type { Client }

export async function createClient(options: {
  readonly username: string
  readonly proxy?: string
}) {
  const { username, proxy } = options
  const ig = new IgApiClient()
  ig.state.generateDevice(JSON.stringify(['live-recorder', username]))
  if (typeof proxy === 'string') {
    const proxyUrl = new URL(proxy)
    if (['http:', 'https:'].includes(proxyUrl.protocol)) {
      ig.state.proxyUrl = proxy
    } else if (['socks:' , 'socks4:' , 'socks4a:' , 'socks5:' , 'socks5h:'].includes(proxyUrl.protocol)) {
      ig.request.defaults.agentClass = shttps
      ig.request.defaults.agentOptions = {
        // @ts-ignore
        hostname: proxyUrl.hostname,
        port: +proxyUrl.port,
        protocol: proxyUrl.protocol,
      };
    }
  }
  const appDataPath = getLocalStorage().path
  await fs.promises.mkdir(appDataPath, { recursive: true })
  const stateFilePath = path.join(appDataPath, `${username}.state.json`)
  ig.request.end$.subscribe(async () => {
    const serialized = await ig.state.serialize()
    delete serialized.constants
    await fs.promises.writeFile(stateFilePath, JSON.stringify(serialized, null, 2))
  })
  await call(async () => {
    if (await exists(stateFilePath)) {
      const buffer = await fs.promises.readFile(stateFilePath)
      const state = call(() => {
        try {
          return JSON.parse(buffer.toString('utf8'))
        } catch (e) {}
      })
      if (state) {
        ig.state.deserialize(state)
        return
      }
    }
    await ig.simulate.preLoginFlow()
    while (true) {
      const pwd = await password(`Please input password to login to ${username}`)
      try {
        await ig.account.login(username, pwd)
      } catch (e) {
        if (typeof e === 'object' && e) {
          if (e instanceof IgLoginBadPasswordError) {
            console.log(chalk.yellowBright(e.response.body.message))
            continue
          }
          if (e instanceof IgLoginTwoFactorRequiredError) {
            const { username, totp_two_factor_on, two_factor_identifier } = e.response.body.two_factor_info
            // decide which method to use
            const verificationMethod = totp_two_factor_on ? '0' : '1'; // default to 1 for SMS
            // At this point a code should have been sent
            // Get the code
            const code = await input(`Enter code received via ${verificationMethod === '1' ? 'SMS' : 'TOTP'}`)
            // Use the code to finish the login process
            await ig.account.twoFactorLogin({
              username,
              verificationCode: code,
              twoFactorIdentifier: two_factor_identifier,
              verificationMethod, // '1' = SMS (default), '0' = TOTP (google auth for example)
              trustThisDevice: '1', // Can be omitted as '1' is used by default
            })
          }
        }
        throw e
      }
      break
    }
    await ig.simulate.postLoginFlow()
  })
  return new Client(ig)
}

export async function logout() {
  const ls = getLocalStorage()
  const config = await ls.getConfig()
  if (config) {
    const { username } = config
    if (username) {
      const stateFilePath = path.join(ls.path, `${username}.state.json`)
      if (await exists(stateFilePath)) {
        await fs.promises.unlink(stateFilePath)
      }
      await ls.setConfig({ ...config, username: undefined })
    }
  }
}

export namespace Broadcast {
  export interface Broadcast {
    id: string
    dash_playback_url: string
    dash_abr_playback_url: null
    dash_live_predictive_playback_url: string
    broadcast_status: string
    viewer_count: number
    internal_only: boolean
    cover_frame_url: string
    cobroadcasters: any[]
    is_player_live_trace_enabled: number
    is_gaming_content: boolean
    is_live_comment_mention_enabled: boolean
    is_live_comment_replies_enabled: boolean
    broadcast_owner: BroadcastOwner
    published_time: number
    hide_from_feed_unit: boolean
    video_duration: number
    media_id: string
    broadcast_message: string
    organic_tracking_token: string
    dimensions: Dimensions
    response_timestamp: number
  }

  export interface BroadcastOwner {
    pk: number
    username: string
    full_name: string
    is_private: boolean
    profile_pic_url: string
    profile_pic_id: string
    friendship_status: FriendshipStatus
    is_verified: boolean
    live_subscription_status: string
  }

  export interface FriendshipStatus {
    following: boolean
    followed_by: boolean
    blocking: boolean
    muting: boolean
    is_private: boolean
    incoming_request: boolean
    outgoing_request: boolean
    is_bestie: boolean
    is_restricted: boolean
  }

  export interface Dimensions {
    height: number
    width: number
  }
}
