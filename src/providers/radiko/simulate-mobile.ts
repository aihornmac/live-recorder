import { sample, random } from 'lodash'

import { VERSION_MAP, MODEL_LIST, APP_VERSIONS, GEO_LOCATION } from './data'
import { keysOf, times } from '../../utils/js'
import { fail } from '../../utils/error'

const HEXCHARS = '01234567890abcdef'

export function generateDeviceInfo() {
  const version = sample(keysOf(VERSION_MAP))!
  const { sdk, builds } = VERSION_MAP[version]
  const build = sample(builds)!
  // Dalvik/2.1.0 (Linux; U; Android %VERSION%; %MODEL%/%BUILD%)
  // X-Radiko-Device: %SDKVERSION%.%NORMALIZEMODEL%
  const model = sample(MODEL_LIST)!
  const device = `${sdk}.${model}`
  const userAgent = `Dalvik/2.1.0 (Linux; U; Android ${version}; ${model}/${build})`
  const appVersion = sample(APP_VERSIONS)!
  const userId = times(32, () => HEXCHARS[random(0, 15)]).join('')
  return { appVersion, userId, userAgent, device }
}

export function generateGPSInfo(areaId: string) {
  const match = areaId.match(/(\d+)/)
  if (!match) {
    throw fail(`Unable to parse areaId as number from ${areaId}`)
  }
  const areaIdNum = +match[1]
  const name = keysOf(GEO_LOCATION)[areaIdNum - 1]
  if (!name) {
    throw fail(`Unknown areaId ${areaIdNum}`)
  }
  const geo = GEO_LOCATION[name]
  let [lat, long] = geo
  // +/- 0 ~ 0.025 --> 0 ~ 1.5' ->  +/-  0 ~ 2.77/2.13km
  lat = lat + Math.random() / 40.0 * (Math.random() > 0.5 ? 1 : -1);
  long = long + Math.random() / 40.0 * (Math.random() > 0.5 ? 1 : -1);
  return lat.toFixed(6) + "," + long.toFixed(6) + ",gps";
}

export class Device {
  readonly info = generateDeviceInfo()
  readonly gps = generateGPSInfo(this.areaId)

  constructor(readonly areaId: string) {}

  getHeaders() {
    const { info, gps } = this
    return {
      'User-Agent': info.userAgent,
      'X-Radiko-App': 'aSmartPhone7a',
      'X-Radiko-App-Version': info.appVersion,
      'X-Radiko-Device': info.device,
      'X-Radiko-User': info.userId,
      'X-Radiko-Location': gps,
      'X-Radiko-Connection': 'wifi',
    }
  }
}
