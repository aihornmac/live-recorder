import * as WebSocket from 'ws'
import { EventEmitter } from 'events'
import chalk = require('chalk')
import { AutoReconnectWebSocket } from '../../utils/websocket'
import { ExternalPromise, createExternalPromise } from '../../utils/js'

export class ShowroomLiveChat {
  private _events: EventEmitter
  private _pingTimer?: NodeJS.Timer
  private _ws: AutoReconnectWebSocket
  private _destroyed: boolean
  private _exaustPromise: ExternalPromise<void>

  constructor(
    readonly host: string,
    readonly port: number,
    readonly key: string,
  ) {
    this._destroyed = false
    this._events = new EventEmitter()
    this._exaustPromise = createExternalPromise()
    const ws = this._ws = new AutoReconnectWebSocket(() => this._createWs())
    ws.start()
  }

  exaust() {
    return this._exaustPromise.promise
  }

  private _createWs() {
    const { host, port, key } = this
    const ws = new WebSocket(`ws://${host}:${port}`)
    ws.on('open', function onOpen(this) {
      console.log('open')
      this.send(`SUB\t${key}`)
    })
    ws.on('message', data => {
      // Data = string | Buffer | ArrayBuffer | Buffer[];
      if (typeof data !== 'string') return
      console.log(data)
      this._events.emit('raw', data)
      const dispatched = dispatchMessage(data)
      if (dispatched) {
        if (dispatched.type === 'msg') {
          this._dispatchMessage(dispatched.content)
        }
      } else {
        console.warn(chalk.yellowBright(`Unknown data:\n${data}`))
      }
      if (this._pingTimer) clearInterval(this._pingTimer)
      this._pingTimer = setInterval(() => this._ping(), 30000)
    })
    ws.on('close', () => {
      if (this._pingTimer) {
        clearInterval(this._pingTimer)
      }
    })
    return ws
  }

  private _ping() {
    const ws = this._ws.native
    if (!ws) return
    console.log('ping')
    ws.send('PING\tshowroom')
  }

  private _dispatchMessage(msg: string) {
    try {
      const pos = msg.indexOf('{')
      if (!pos) return
      const json: Payload = JSON.parse(msg.slice(pos))

      this._events.emit('event', json)

      if (json.t === 101) {
        // quit
        this.destroy()
        return
      }
    } catch (e) {
      console.error(chalk.redBright(`Failed to parse message`))
      console.error(e)
    }
  }

  destroy() {
    if (this._destroyed) return
    this._destroyed = true
    try {
      if (this._pingTimer) {
        clearInterval(this._pingTimer)
      }
      const ws = this._ws.native
      if (ws) {
        ws.send('QUIT')
      }
    } finally {
      this._exaustPromise.resolve()
    }
  }

  on(event: 'event', fn: (payload: Payload) => void): this
  on(event: 'raw', fn: (msg: string) => void): this
  on(event: string, fn: (...args: any[]) => unknown) {
    this._events.on(event, fn)
    return this
  }

  off(event: 'event', fn: (payload: Payload) => void): this
  off(event: 'raw', fn: (msg: string) => void): this
  off(event: string, fn: (...args: any[]) => unknown) {
    this._events.off(event, fn)
    return this
  }
}

export type Payload = (
  | CommentPayload
  | QuitPayload
)

export interface CommentPayload {
  t: '1'
  ac: string // account
  cm: string // comment
  created_at: number // timestamp in second
}

export interface GiftPayload {
  t: '2'
  ac: string // account
  g: number // gift id
  n: number // gift quantity
  created_at: number // timestamp in second
}

export interface QuitPayload {
  t: 101
  created_at: number // timestamp in second
}

const RECEIVE_MESSAGE_TYPES = [{
  type: 'msg',
  prefix: 'MSG',
}, {
  type: 'ack',
  prefix: 'ACK',
}] as const

function dispatchMessage(msg: string) {
  for (const item of RECEIVE_MESSAGE_TYPES) {
    if (msg.startsWith(item.prefix)) {
      return {
        type: item.type,
        content: msg,
      }
    }
  }
  return
}
