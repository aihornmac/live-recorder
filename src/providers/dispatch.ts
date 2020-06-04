import * as chalk from 'chalk'

import * as providers from './providers'
import { CommonCreateOptions } from './common/typed-input'
import { entriesOf } from '../utils/js'
import { isErrorPayload, fail } from '../utils/error'

export function dispatch(url: string, options: CommonCreateOptions) {
  if (!url){
    throw fail(chalk.redBright(`input url is empty`))
  }
  for (const entry of entriesOf(providers)) {
    const [name, methods] = entry
    const ret = methods.match(url, options)
    if (isErrorPayload(ret)) {
      if (ret.code === 'provider mismatch') continue
      const { data } = ret
      throw fail(chalk.redBright(`[${name}] ${ret.code}: ${ret.message}${data ? `\n${JSON.stringify(data)}` : ''}`))
    }
    console.log(chalk.cyan(`Provider: ${name}`))
    return ret
  }
  throw fail(`unknown provider ${url}`)
}
