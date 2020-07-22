import { ExternalPromise, createExternalPromise } from './js'
import { TypedEventEmitterListener, TypeNodeJSEventEmitter } from './types'
import { EventEmitter } from 'events'

export type PipeStreamEventMap = {
  drain(...args: unknown[]): void
}

export class PipeStream<T> {
  protected _requests: Array<ExternalPromise<StreamResult<T>>> = []
  protected _responses: T[] = []
  protected _isEnded = false
  protected _isPaused = false
  protected _events = new EventEmitter() as TypeNodeJSEventEmitter<PipeStreamEventMap>
  protected _bufferSize: number

  constructor(options?: {
    readonly bufferSize?: number
  }) {
    this._bufferSize = formatBufferSize(options?.bufferSize)
  }

  get isEnded() {
    return this._isEnded
  }

  get hasReads() {
    return this._requests.length > 0
  }

  get hasWrites() {
    return this._responses.length > 0
  }

  get events(): TypedEventEmitterListener<PipeStreamEventMap> {
    return this._events
  }

  end() {
    if (this._isEnded) return
    this._isEnded = true
    this._end()
  }

  resume() {
    if (this._isEnded) return
    if (!this._isPaused) return
    this._isPaused = false
    let responses = this._responses
    if (responses.length) {
      let requests = this._requests
      if (requests.length) {
        const length = Math.min(responses.length, requests.length)
        responses = responses.splice(0, length)
        requests = requests.splice(0, length)
        for (let i = 0; i < length; i++) {
          requests[i].resolve({ done: false, value: responses[i] })
        }
        if (responses.length < this._bufferSize) {
          process.nextTick(() => this._events.emit('drain'))
        }
      }
    }
  }

  pause() {
    if (this._isEnded) return
    if (this._isPaused) return
    this._isPaused = true
  }

  write(value: T) {
    if (this._isEnded) {
      throw new Error(`Stream is ended!`)
    }
    if (!this._isPaused) {
      const requests = this._requests
      if (requests.length) {
        const xp = requests.shift()!
        xp.resolve({ done: false, value })
        return requests.length > 0 || this._responses.length < this._bufferSize
      }
    }
    this._responses.push(value)
    return false
  }

  async read() {
    if (!this._isPaused) {
      const responses = this._responses
      if (responses.length) {
        const value = responses.shift() as T
        if (responses.length < this._bufferSize) {
          process.nextTick(() => this._events.emit('drain'))
        }
        return { done: false as const, value: value }
      }
    }
    if (this._isEnded) {
      return { done: true as const, value: undefined }
    }
    const xp = createExternalPromise<StreamResult<T>>()
    this._requests.push(xp)
    return xp.promise
  }

  protected _end() {
    for (const xp of this._requests) {
      xp.resolve({ done: true, value: undefined })
    }
  }

  async * [Symbol.asyncIterator]() {
    while (true) {
      const ret = await this.read()
      if (ret.done) return ret.value
      yield ret.value
    }
  }
}

export type StreamResult<T> = {
  done: false
  value: T
} | {
  done: true
  value: undefined
}

function formatBufferSize(value: unknown) {
  const v = Math.ceil(Number(value))
  if (Number.isFinite(v) && v > 0) return v
  return 1
}
