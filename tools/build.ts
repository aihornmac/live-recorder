import { run, exec } from './common'
import * as path from 'path'

if (require.main === module) {
  run(main)
}

export async function main() {
  const projectPath = path.join(__dirname, '..')
  const webackPath = path.join(projectPath, 'node_modules', '.bin', 'webpack')
  const webpackConfig = path.join(__dirname, 'webpack.config.ts')
  const tmpPath = path.join(projectPath, 'tmp')
  const tmpLibPath = path.join(tmpPath, 'lib')
  const libPath = path.join(projectPath, 'lib')

  await exec(`rm -rf ${tmpPath}`)

  try {
    await exec(`node ${JSON.stringify(webackPath)} --config ${JSON.stringify(webpackConfig)}`)
    await exec(`rm -rf ${libPath} && mv ${tmpLibPath} ${libPath}`)
  } finally {
    await exec(`rm -rf ${tmpPath}`)
  }
}
