import * as path from 'path'
import * as fs from 'fs'

import { Muxer } from '../../utils/mux'
import { createSequencePromise, call, createExternalPromise } from '../../utils/js'
import { waitForWriteStreamFinish } from '../../utils/node-stream'
import { exec } from '../../utils/cli'
import { EventEmitter } from 'events'
import { TypeNodeJSEventEmitter, TypedEventEmitterListener } from '../../utils/types'
import { AbstractExecutor } from '../common/executor'

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
    const { chunksPath, outputPath, fileNames } = options

    // merge chunks

    this._events.emit('increase total', fileNames.length)

    const muxer = new Muxer()
    const writeStream = fs.createWriteStream(outputPath)

    const readLoop = call(async () => {
      const writeSequence = createSequencePromise()
      for (const fileName of fileNames) {
        writeSequence(async () => {
          const buffer = await fs.promises.readFile(path.join(chunksPath, fileName))
          const shouldWrite = muxer.write({ buffer, data: undefined })
          if (!shouldWrite) {
            const xp = createExternalPromise<void>()
            muxer.inputEvents.once('drain', xp.resolve)
            await xp.promise
          }
        })
      }
      await writeSequence(() => {})
      muxer.end()
    })

    const writeLoop = call(async () => {
      for await (const { buffer } of muxer) {
        await this.untilAvailable()
        const shouldWrite = writeStream.write(buffer)
        if (!shouldWrite) {
          const xp = createExternalPromise<void>()
          writeStream.once('drain', xp.resolve)
          await xp.promise
        }
        this._events.emit('increase progress', 1)
      }
      writeStream.end()
      if (!writeStream.writableFinished) {
        await waitForWriteStreamFinish(writeStream)
      }
    })

    await Promise.all([readLoop, writeLoop])

    // since mux.js doesn't handle duration correctly, so use ffmpeg to format it

    const tmpOutputDir = await fs.promises.mkdtemp(outputPath + '.')
    const tmpOutputPath = path.join(tmpOutputDir, 'tmp')

    await fs.promises.rename(outputPath, tmpOutputPath)

    await exec(`ffmpeg -i ${JSON.stringify(tmpOutputPath)} -c copy ${JSON.stringify(outputPath)}`, { silent: true })

    await fs.promises.rmdir(tmpOutputDir, { recursive: true })
  }
}
