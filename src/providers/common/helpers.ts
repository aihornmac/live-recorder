import * as chalk from 'chalk'
import { call } from '../../utils/js'
import { ProgressBar } from '../../utils/progress-bar'

export function formatDurationInSeconds(time: number) {
  const decimals = time % 1
  time = Math.floor(time)

  const seconds = time % 60
  time = (time - seconds) / 60

  const minutes = time % 60
  time = (time - minutes) / 60

  return { hours: time, minutes, seconds, decimals }
}

export type FormattedDuration = Partial<Readonly<ReturnType<typeof formatDurationInSeconds>>>

export function stringifyDuration(input: FormattedDuration) {
  const integer = (
    [input.hours || 0, input.minutes || 0, input.seconds || 0]
      .map(x => padLeft(String(x), '00'))
      .join(':')
  )
  const decimals = !input.decimals ? '' : padLeft(String(input.decimals), '000').slice(0, 3)
  return [integer, decimals].filter(Boolean).join('.')
}

export function padLeft(input: string, padding: string) {
  return (padding + input).slice(-padding.length)
}

export function pickStream<T extends {
  readonly data: {
    readonly BANDWIDTH?: number
    readonly RESOLUTION?: {
      readonly width?: number
      readonly height?: number
    }
  }
}>(streams: readonly T[], criteria?: string): T | undefined {
  if (!streams.length) return

  if (!criteria) criteria = 'best'

  let defaultStream = streams[0]

  if (streams.every(stream => Number(stream.data.BANDWIDTH) > 0)) {
    // sort from highest bandwidth to lowest
    const sorted = streams.slice().sort((a, b) => b.data.BANDWIDTH! - a.data.BANDWIDTH!)
    if (criteria === 'best') return sorted[0]
    if (criteria === 'worst') return sorted[sorted.length - 1]
    defaultStream = sorted[0]
  }

  if (streams.every(stream => stream.data.RESOLUTION)) {
    const isAllHasWidth = streams.every(stream => {
      const value = stream.data.RESOLUTION!.width
      return typeof value === 'number' && value > 0
    })
    const isAllHasHeight = streams.every(stream => {
      const value = stream.data.RESOLUTION!.height
      return typeof value === 'number' && value > 0
    })
    if (isAllHasWidth || isAllHasHeight) {
      // sort from highest quality to lowest
      const sorted = streams.map(x => {
        const { width, height } = x.data.RESOLUTION!
        const quality = isAllHasWidth ? isAllHasHeight ? width! * height! : width! : height!
        return { original: x, quality }
      }).sort((a, b) => b.quality - a.quality)

      if (criteria === 'best') return sorted[0].original
      if (criteria === 'worst') return sorted[sorted.length - 1].original

      // try to match format like 1080p
      const matchP = criteria.match(/^([0-9]+)p$/i)
      if (matchP) {
        const p = +matchP[1]
        for (const { original: stream } of sorted) {
          if (stream.data.RESOLUTION!.height === p) return stream
        }
      }

      // try to match format like 2k, 4k, 8k
      const matchK = criteria.match(/^([0-9]+)k$/i)
      if (matchK) {
        const k = +matchK[1]
        const start = k * 1000 - 500
        const end = k * 1000 + 500
        for (const { original: stream } of sorted) {
          const { width } = stream.data.RESOLUTION!
          if (typeof width === 'number' && width >= start && width < end) return stream
        }
      }

      defaultStream = sorted[0].original
    }
  }

  return defaultStream
}


export function printStreamChoices<T extends {
  readonly data: {
    readonly BANDWIDTH?: number
    readonly RESOLUTION?: {
      readonly width?: number
      readonly height?: number
    }
  }
}>(streams: readonly T[], picked: T) {
  if (!streams.length) {
    console.error(chalk.redBright(`No stream found`))
    return
  }

  console.log(`Found multiple streams:`)

  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i]
    const used = stream === picked
    const { BANDWIDTH: bandwidth, RESOLUTION: resolution } = stream.data
    const parts = [`[${i}]`]
    call(() => {
      if (resolution && typeof resolution === 'object') {
        const { width, height } = resolution
        if (typeof width === 'number') {
          if (typeof height === 'number') {
            parts.push(`${width}x${height}`)
          } else {
            parts.push(`${width}`)
          }
          return
        } else if (typeof height === 'number') {
          parts.push(`${height}`)
          return
        }
      }
      if (bandwidth) {
        parts.push(`${bandwidth} bps`)
      }
    })
    if (used) {
      parts.push(`[used]`)
    }
    const msg = parts.join(' ')
    console.log(used ? chalk.white(msg) : chalk.gray(msg))
  }
}

export function createDownloadProgressBar() {
  return new ProgressBar({
    smooth: 100,
    freshRate: 1,
    formatValue: (value, _, type) => {
      if (type === 'value' || type === 'total') {
        return stringifyDuration(formatDurationInSeconds(Math.floor(+value)))
      }
      return value
    }
  })
}
