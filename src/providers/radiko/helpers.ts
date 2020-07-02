import * as fxp from 'fast-xml-parser'

import { fail } from '../../utils/error'
import { GEO_LOCATION } from './data'
import { keysOf } from '../../utils/js'

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
  const geo: readonly [number, number] = GEO_LOCATION[name]
  let [lat, long] = geo
  // +/- 0 ~ 0.025 --> 0 ~ 1.5' ->  +/-  0 ~ 2.77/2.13km
  lat = lat + Math.random() / 40.0 * (Math.random() > 0.5 ? 1 : -1);
  long = long + Math.random() / 40.0 * (Math.random() > 0.5 ? 1 : -1);
  return lat.toFixed(6) + "," + long.toFixed(6) + ",gps";
}

export function parseXML<T>(xml: string): T {
  return fxp.parse(xml, {
    ignoreAttributes: false,
  })
}
