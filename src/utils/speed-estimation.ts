export class SpeedEstimation {
  private list: Array<{
    timestamp: number
    size: number
  }> = []

  constructor(readonly samples = 10) { }

  get speed() {
    const { list } = this
    const { length } = list
    if (length > 1) {
      const first = list[0]
      const last = list[length - 1]
      const ds = last.size - first.size
      const dt = (last.timestamp - first.timestamp) / 1000
      return dt > 0 ? ds / dt : 0
    }
    return 0
  }

  push(size: number) {
    const { list, samples } = this
    const last = list[list.length - 1]
    if (list.length >= samples) {
      list.splice(0, Math.max(0, list.length - samples + 1))
    }
    list.push({
      timestamp: Date.now(),
      size: size + (last && last.size || 0),
    })
  }
}
