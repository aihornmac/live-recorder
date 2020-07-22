import { createExternalPromise, ExternalPromise } from '../../utils/js'

export abstract class AbstractExecutor<T = void> {
  private _xp = createExternalPromise<T>()
  private _executed = false
  private _halt?: ExternalPromise<void> = createExternalPromise()

  get executed() {
    return this._executed
  }

  get isAvailable() {
    return !this._halt
  }

  untilAvailable() {
    return this._halt?.promise
  }

  start() {
    if (!this._halt) return
    this._halt.resolve()
    this._halt = undefined
    if (!this._executed) {
      this._executed = true
      const { resolve, reject } = this._xp
      this._execute().then(resolve, reject)
    }
  }

  stop() {
    if (this._halt) return
    this._halt = createExternalPromise()
  }

  exaust() {
    return this._xp.promise
  }

  protected abstract async _execute(): Promise<T>
}
