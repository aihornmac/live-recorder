import * as path from 'path'
import type { Configuration } from 'webpack'
import * as ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'

module.exports = getWebpackConfiguration()

function getWebpackConfiguration(): Configuration {
  const projectPath = path.join(__dirname, '..')
  const srcPath = path.join(projectPath, 'src')
  const tmpPath = path.join(projectPath, 'tmp')
  const tsConfigPath = path.join(srcPath, 'tsconfig.build.json')

  return {
    target: 'node',

    context: projectPath,

    entry: path.join(srcPath, 'entry.ts'),

    output: {
      path: path.join(tmpPath, 'lib'),
      filename: 'entry.js',
      libraryTarget: 'umd',
    },

    devtool: 'source-map',

    resolve: {
      extensions: ['.tsx', '.ts', '.mjs', '.js']
    },

    stats: 'errors-only',

    module: {
      rules: [
        {
          test: /\.(t|j)sx?$/,
          exclude: m => m.includes('node_modules'),
          use: [{
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: tsConfigPath,
            },
          }],
        },
      ],
    },

    plugins: [
      new ForkTsCheckerWebpackPlugin({
        silent: true,
        tsconfig: tsConfigPath,
      }),
    ],
  }
}
