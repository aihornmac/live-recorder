import { createExternalPromise } from './js'

export function waitForWriteStreamFinish(stream: NodeJS.WritableStream) {
  const xp = createExternalPromise<void>()
  stream.on('finish', () => xp.resolve())
  return xp.promise
}
