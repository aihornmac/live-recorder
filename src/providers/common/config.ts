import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

import { call } from '../../utils/js'
import { fail, ApplicationError } from '../../utils/error'
import { exists } from '../../utils/fs'

const LIVE_RECORDER_CONFIG_PATH = path.join(os.homedir(), '.live-recorder')

export type InvalidJsonError = ApplicationError<'invalid json', {
  provider: string
  text: string
}>

export async function getConfig<T>(provider: string) {
  const configPath = getConfigPath(provider)
  const stat = await exists(configPath)
  if (!stat) return
  const buffer = await fs.promises.readFile(configPath)
  const text = buffer.toString('utf8')
  return call((): T => {
    try {
      return JSON.parse(text)
    } catch (e) {
      const error: InvalidJsonError = fail('invalid json', `Unable to parse configuration of ${provider}`, {
        provider,
        text,
      })
      throw error
    }
  })
}

export async function setConfig<T>(provider: string, config: T) {
  const configPath = getConfigPath(provider)
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2))
}

function getConfigPath(provider: string) {
  return path.join(LIVE_RECORDER_CONFIG_PATH, provider)
}

export class ConfigOperator<T> {
  constructor(readonly provider: string) {}

  get() {
    return getConfig<T>(this.provider)
  }

  set(config: T) {
    return setConfig<T>(this.provider, config)
  }
}
