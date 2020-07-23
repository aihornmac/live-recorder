import * as path from 'path'
import * as fs from 'fs'

import { call, createExternalPromise } from '../../utils/js'
import { EventEmitter } from 'events'
import { TypeNodeJSEventEmitter, TypedEventEmitterListener } from '../../utils/types'
import { AbstractExecutor } from '../common/executor'
import { Readable } from 'stream'

export type MergeEventMap = {
  ['increase progress'](value: number): void
  ['increase total'](value: number): void
}

export class Merge extends AbstractExecutor {
  private _events = new EventEmitter() as TypeNodeJSEventEmitter<MergeEventMap>

  constructor(readonly options: {
    readonly chunksPath: string
    readonly outputPath: string
    readonly fileNames: readonly string[]
  }) {
    super()
  }

  get events(): TypedEventEmitterListener<MergeEventMap> {
    return this._events
  }

  protected async _execute() {
    const { options } = this
    const events = this._events

    const { chunksPath, outputPath, fileNames } = options

    events.emit('increase total', fileNames.length)

    const writeStream = fs.createWriteStream(outputPath)
    const readStream = Readable.from(call(async function *() {
      for (const fileName of fileNames) {
        yield * fs.createReadStream(path.join(chunksPath, fileName))
        events.emit('increase progress', 1)
      }
    }))
    readStream.pipe(writeStream)
    const xp = createExternalPromise<void>()
    writeStream.on('error', xp.reject)
    writeStream.on('finish', xp.resolve)
    await xp.promise
  }
}
