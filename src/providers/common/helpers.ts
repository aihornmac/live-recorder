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
