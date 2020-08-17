declare module 'fast-xml-parser' {
  export interface ParseOptions {
    readonly attributeNamePrefix?: string
    readonly ignoreAttributes?: boolean
    readonly arrayMode?: boolean
  }
  export function parse<T = unknown>(xml: string, options?: ParseOptions): T
}
