declare module 'webpack-visualizer-plugin' {
  import { Plugin } from 'webpack'

  export interface Options {
    /**
     * output filename, defaults to 'stats.html'
     */
    readonly filename: string
  }

  export class Visualizer extends Plugin {
    readonly opts: Options

    constructor(readonly options?: Options)
  }

  export = Visualizer

  export namespace Visualizer {}
}
