import * as WebSocket from 'ws'

export class AutoReconnectWebSocket {
  private _started = false
  private _ws?: WebSocket

  constructor(readonly create: () => WebSocket) {
    this._launch = this._launch.bind(this)
  }

  get native() {
    return this._ws
  }

  get started() {
    return this._started
  }

  start() {
    if (this._started) return
    this._started = true
    this._launch()
  }

  stop() {
    if (!this._started) return
    this._started = false
    const ws = this._ws
    if (ws) {
      ws.removeListener('close', this._launch)
      ws.close()
    }
    this._ws = undefined
  }

  private _launch() {
    if (!this._started) return
    const ws = this._ws = this.create()
    ws.once('close', this._launch)
  }
}
