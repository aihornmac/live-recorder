declare module 'mux.js' {
  export namespace mp4 {
    export const Transmuxer: TransmuxerContructor

    export interface Segment {
      captionStreams: {}
      captions: unknown[]
      data: Uint8Array
      initSegment: Uint8Array
      info: {
        width: number
        height: number
        levelIdc: number
        profileIdc: number
        profileCompatibility: number
      }
    }

    export interface TransmuxerContructor {
      new (): Transmuxer
    }

    export interface Transmuxer {
      on(event: 'data', cb: (segment: Segment) => void): void
      on(event: 'error', cb: (error: unknown) => void): void

      off(event: 'data', cb?: (segment: Segment) => void): void
      off(event: 'error', cb?: (error: unknown) => void): void

      push(typedArray: Uint8Array): void
      flush(): void
    }
  }
}
