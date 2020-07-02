declare module 'fast-xml-parser' {
  export interface ParseOptions {
    readonly ignoreAttributes?: boolean
  }
  export function parse<T = unknown>(xml: string, options?: ParseOptions): T
}
