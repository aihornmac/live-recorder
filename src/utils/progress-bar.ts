import { SingleBar, Presets, Options } from 'cli-progress'
import { SpeedEstimation } from './speed-estimation'

export class ProgressBar {
  private _total = 0
  private _value = 0
  private _bar: SingleBar
  private _speed: SpeedEstimation
  private _started = false

  constructor(options?: {
    smooth?: number
    freshRate?: number
    formatValue?: (value: string, options: Options, type: 'duration' | 'eta' | 'value' | 'total' | 'percentage') => string
  }) {
    const etaBuffer = options?.smooth || 10
    this._bar = new SingleBar({
      format: `{bar} {percentage}% | {duration_formatted} < {eta_formatted} | {value}/{total} | {speed}x`,
      fps: options?.freshRate,
      etaBuffer: etaBuffer,
      formatValue: options?.formatValue as Function as (value: number, options: Options, type: string) => string,
    }, Presets.shades_grey)
    this._speed = new SpeedEstimation(etaBuffer)
  }

  start() {
    if (this._started) return
    this._started = true
    const speed = this._speed.speed
    this._bar.start(this._total, this._value, {
      speed: Number.isFinite(speed) ? speed.toFixed(2) : 'N/A',
    })
  }

  stop() {
    if (!this._started) return
    this._started = false
    this._bar.stop()
  }

  increaseTotal(value: number) {
    if (!value) return
    this._total += value
    this._bar.setTotal(this._total)
  }

  increaseValue(value: number) {
    if (!value) return
    this._value += value
    this._speed.push(value)
    const speed = this._speed.speed
    this._bar.increment(value, {
      speed: Number.isFinite(speed) ? speed.toFixed(2) : 'N/A',
    })
  }
}
