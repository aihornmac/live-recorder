import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

import { call } from '../../utils/js'
import { fail, ApplicationError } from '../../utils/error'
import { exists } from '../../utils/fs'

const LIVE_RECORDER_PATH = path.join(os.homedir(), '.live-recorder')

export type InvalidJsonError = ApplicationError<'invalid json', {
  provider: string
  text: string
}>

export class LocalStorage<T> {
  readonly path: string

  constructor(readonly provider: string) {
    this.path = path.join(LIVE_RECORDER_PATH, provider)
  }

  async getConfig() {
    const configPath = path.join(this.path, 'config.json')
    const stat = await exists(configPath)
    if (!stat) return
    const buffer = await fs.promises.readFile(configPath)
    const text = buffer.toString('utf8')
    return call((): T => {
      try {
        return JSON.parse(text)
      } catch (e) {
        const error: InvalidJsonError = fail('invalid json', `Unable to parse configuration of ${this.provider}`, {
          provider: this.provider,
          text,
        })
        throw error
      }
    })
  }

  async setConfig(config: T) {
    const configPath = path.join(this.path, 'config.json')
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2))
  }
}
