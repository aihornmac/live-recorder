import * as sh from 'shelljs'
import type { ChildProcess } from 'child_process'

export async function run<T = void>(fn: () => T | PromiseLike<T>) {
  try {
    await fn()
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

export function execSafe(command: string, options?: sh.ExecOptions) {
  let cp!: ChildProcess
  const promise = new Promise<sh.ExecOutputReturnValue>(resolve => {
    const cb: sh.ExecCallback = (code, stdout, stderr) => {
      resolve({ code, stdout, stderr })
    }
    if (options) {
      cp = sh.exec(command, options, cb)
    } else {
      cp = sh.exec(command, cb)
    }
  })
  return { cp, promise }
}

export async function exec(command: string, options?: sh.ExecOptions) {
  const { code, stdout, stderr } = await execSafe(command, options).promise
  if (code !== 0) throw stderr
  return stdout
}
