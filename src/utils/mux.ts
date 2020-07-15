import * as muxjs from 'mux.js'
import { PipeStream } from './stream'

export interface MuxData<T> {
  buffer: Buffer
  data: T
}

export class Muxer<T> {
  private readonly _transmuxer = new muxjs.mp4.Transmuxer()
  private readonly _idle = new PipeStream<void>()
  private readonly _input = new PipeStream<MuxData<T>>()
  private readonly _output = new PipeStream<MuxData<T>>()
  private _isDestroyed = false
  private _isEnded = false
  private _inputCount = 0
  private _outputCount = 0

  constructor() {
    Promise.resolve().then(() => {
      this._idle.write()
      this._loop()
    })
  }

  write(input: MuxData<T>) {
    this._inputCount++
    return this._input.write(input)
  }

  read() {
    return this._output.read()
  }

  end() {
    if (this._isEnded) return
    this._isEnded = true
    this._input.end()
    if (this._inputCount >= this._outputCount) {
      this._output.end()
    }
  }

  destroy() {
    if (this._isDestroyed) return
    this._isDestroyed = true
    this.end()
  }

  async * [Symbol.asyncIterator]() {
    yield * this._output
  }

  private async _loop() {
    while (true) {
      if (this._isDestroyed) return

      const idle = await this._idle.read()
      // idle is closed, end loop
      if (idle.done) return

      if (this._isDestroyed) return

      const input = await this._input.read()
      // input stream is closed, end loop
      if (input.done) return

      if (this._isDestroyed) return

      const count = this._outputCount++
      const { buffer, data } = input.value
      const transmuxer = this._transmuxer
      if (!count) {
        transmuxer.on('data', segment => {
          this._transmuxer.off('data')
          if (this._isDestroyed) return
          const decoded = new Uint8Array(segment.initSegment.byteLength + segment.data.byteLength)
          decoded.set(segment.initSegment, 0)
          decoded.set(segment.data, segment.initSegment.byteLength)
          this._output.write({ buffer: Buffer.from(decoded), data })
          if (this._input.isEnded) {
            this._output.end()
          }
          this._idle.write()
        })
      } else {
        transmuxer.on('data', segment => {
          this._transmuxer.off('data')
          if (this._isDestroyed) return
          const decoded = new Uint8Array(segment.data)
          this._output.write({ buffer: Buffer.from(decoded), data })
          if (this._input.isEnded) {
            this._output.end()
          }
          this._idle.write()
        })
      }
      transmuxer.push(buffer)
      transmuxer.flush()
    }
  }
}
