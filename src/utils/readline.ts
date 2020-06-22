import * as readline from 'readline'
import { Readable } from 'stream'
import { PipeStream } from './stream'

export async function * readlineFromBuffer(input: string | Buffer) {
  const stream = new PipeStream<string>()
  const rl = readline.createInterface(Readable.from([input]))
  rl.on('line', line => stream.write(line))
  rl.on('close', () => stream.end())
  try {
    while (true) {
      const ret = await stream.read()
      if (ret.done) break
      yield ret.value
    }
  } finally {
    rl.close()
  }
}
