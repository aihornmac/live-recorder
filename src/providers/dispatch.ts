import * as chalk from 'chalk'
import { URL } from 'url'

import * as providers from './providers'
import { entriesOf, isObjectHasKey } from '../utils/js'
import { isErrorPayload, fail } from '../utils/error'

export function commands(provider: string) {
  if (isObjectHasKey(providers, provider)) {
    const { commands } = providers[provider]
    if (!commands) return async () => {}
    return commands
  }
  return false
}

export function record(url: string) {
  if (!url){
    throw fail(chalk.redBright(`input url is empty`))
  }
  let u: URL
  try {
    u = new URL(url)
  } catch (e) {
    if (e && e.code === 'ERR_INVALID_URL') {
      throw fail(chalk.redBright(`Invalid URL ${url}`))
    }
    throw e
  }
  for (const entry of entriesOf(providers)) {
    const [name, methods] = entry
    const ret = methods.match(u)
    if (isErrorPayload(ret)) {
      if (ret.code === 'provider mismatch') continue
      const { data } = ret
      throw fail(chalk.redBright(`[${name}] ${ret.code}: ${ret.message}${data ? `\n${JSON.stringify(data)}` : ''}`))
    }
    console.log(chalk.cyan(`Provider: ${name}`))
    return ret
  }
  throw fail(`unknown provider for ${url}`)
}
