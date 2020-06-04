export class Clicker {
  private _clicks = 0
  private _timer?: NodeJS.Timeout

  constructor(readonly interval: number) {}

  get count() {
    return this._clicks
  }

  click() {
    if (this._timer) clearTimeout(this._timer)
    this._timer = setTimeout(() => { this._clicks = 0 }, this.interval)
    return ++this._clicks
  }
}
