import * as path from 'path'
import { DefinePlugin } from 'webpack'
import type { Configuration } from 'webpack'
import * as ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import * as Visualizer from 'webpack-visualizer-plugin'

module.exports = getWebpackConfiguration()

function getWebpackConfiguration(): Configuration {
  const projectPath = path.join(__dirname, '..')
  const packageJsonPath = path.join(projectPath, 'package.json')
  const srcPath = path.join(projectPath, 'src')
  const tmpPath = path.join(projectPath, 'tmp')
  const tsConfigPath = path.join(srcPath, 'tsconfig.build.json')
  const outputPath = path.join(tmpPath, 'lib')

  return {
    target: 'node',

    context: projectPath,

    entry: path.join(srcPath, 'entry.ts'),

    output: {
      path: outputPath,
      filename: 'entry.js',
      libraryTarget: 'umd',
    },

    node: {
      __dirname: false,
      __filename: false,
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
        {
          test: /\.bin$/,
          exclude: m => m.includes('node_modules'),
          loader: 'file-loader',
        },
      ],
    },

    plugins: [
      new ForkTsCheckerWebpackPlugin({
        silent: true,
        tsconfig: tsConfigPath,
      }),
      ...(!process.env.ANALYZE ? [] : [
        new Visualizer({
          filename: path.relative(outputPath, path.join(projectPath, 'stats.html')),
        }),
      ]),
      new DefinePlugin({
        __VERSION__: JSON.stringify(require(packageJsonPath).version),
        __IS_PROD__: JSON.stringify(true),
      })
    ],
  }
}
