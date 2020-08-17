import * as fxp from 'fast-xml-parser'
import { fail } from './error'

export function parse(input: string) {
  const ret = fxp.parse<{ MPD: Manifest.Mpd[] }>(input, {
    attributeNamePrefix: '',
    ignoreAttributes: false,
    arrayMode: true,
  })
  const list = ret.MPD
  if (!list.length) {
    throw fail(`MPD not found`)
  }
  return list[0]
}

export class ManifestParser {
  mpd(mpd: Manifest.Mpd): ParsedManifest.MPD {
    const { type } = mpd
    if (!(type === 'static' || type === 'dynamic')) {
      throw new Error(`Unknown mpd type ${type}`)
    }
    return {
      __original: mpd,
      baseUrl: mpd.BaseURL,
      type,
      periods: mpd.Period.map(this.period, this),
      mediaPresentationDuration: this.presentationDuration(mpd.mediaPresentationDuration),
    }
  }

  period(period: Manifest.Period): ParsedManifest.Period {
    return {
      __original: period,
      baseUrl: period.BaseURL,
      adaptationSets: period.AdaptationSet.map(this.adaptationSet, this),
    }
  }

  adaptationSet(adaptationSet: Manifest.AdaptationSet): ParsedManifest.AdaptationSet {
    return {
      __original: adaptationSet,
      baseUrl: adaptationSet.BaseURL,
      mimeType: adaptationSet.mimeType,
      representations: adaptationSet.Representation.map(this.representation, this),
    }
  }

  representation(representation: Manifest.Representation): ParsedManifest.Representation {
    const segmentTemplate = representation.SegmentTemplate?.[0]
    return {
      __original: representation,
      baseUrl: representation.BaseURL,
      id: representation.id,
      bandwidth: +representation.bandwidth,
      width: toNumber(representation.width),
      height: toNumber(representation.height),
      segmentTemplate: segmentTemplate ? this.segmengTemplate(segmentTemplate) : undefined,
      codecs: representation.codecs,
      frameRate: representation.frameRate,
      audioSamplingRate: representation.audioSamplingRate,
      mimeType: representation.mimeType,
    }
  }

  segmengTemplate(segmentTemplate: Manifest.SegmentTemplate): ParsedManifest.SegmentTemplate {
    const segmentTimeline = segmentTemplate.SegmentTimeline?.[0]
    return {
      __original: segmentTemplate,
      media: segmentTemplate.media,
      timescale: +segmentTemplate.timescale,
      segmentTimeline: segmentTimeline ? this.segmentTimeline(segmentTimeline) : undefined,
      initialization: segmentTemplate.initialization,
      startNumber: toNumber(segmentTemplate.startNumber),
      duration: toNumber(segmentTemplate.duration),
    }
  }

  segmentTimeline(segmentTimeline: Manifest.SegmentTimeline): ParsedManifest.SegmentTimeline {
    return {
      __original: segmentTimeline,
      segments: segmentTimeline.S.map(this.segment, this),
    }
  }

  segment(segment: Manifest.Segment): ParsedManifest.Segment {
    const d = toNumber(segment.d)
    if (typeof d !== 'number' || !Number.isFinite(d)) {
      throw new Error(`S@d is absent or invalid`)
    }
    return {
      __original: segment,
      t: toNumber(segment.t),
      r: toNumber(segment.r),
      d,
    }
  }

  presentationDuration(input: string): number
  presentationDuration(input?: string): number | undefined
  presentationDuration(input?: string) {
    if (typeof input !== 'string') return
    const duration = parsePresentationDuration(input)
    if (!duration) {
      throw new Error(`Unable to parse presentation duration, given ${JSON.stringify(input)}`)
    }
    return presentationDurationToSeconds(duration)
  }
}

function toNumber(x?: string) {
  if (typeof x === 'string') return +x
  return undefined
}

const MATCH_DURATION = new RegExp([
  `P`,
  `(?:(?<year>[0-9]+)Y)?`,
  `(?:(?<month>[0-9]+)M)?`,
  `(?:(?<day>[0-9]+)D)?`,
  `T`,
  `(?:(?<hour>[0-9]+)H)?`,
  `(?:(?<minute>[0-9]+)M)?`,
  `(?:(?<second>[0-9]+(?:\.[0-9]+)?)S)`
].join(''), 'i')

export interface PresentationDuration {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function parsePresentationDuration(input: string) {
  const match = input.match(MATCH_DURATION)
  if (!match) return
  const { year, month, day, hour, minute, second } = match.groups!
  return {
    year: +year || 0,
    month: +month || 0,
    day: +day || 0,
    hour: +hour || 0,
    minute: +minute || 0,
    second: +second || 0,
  }
}

export function presentationDurationToSeconds(duration: Readonly<PresentationDuration>): number {
  // All units expressed in MPD fields of datatype xs:duration SHALL be treated as fixed size:
  // 60S = 1M (minute)
  // 60M = 1H
  // 24H = 1D
  // 30D = 1M (month)
  // 12M = 1Y
  const { year, month, day, hour, minute, second } = duration
  return ((((year * 12 + month) * 30 + day) * 24 + hour) * 60 + minute) * 60 + second
}

export namespace ParsedManifest {
  export interface MPD {
    __original: Manifest.Mpd
    baseUrl?: string
    type: 'static' | 'dynamic'
    periods: Period[]
    mediaPresentationDuration?: number
  }

  export interface Period {
    __original: Manifest.Period
    baseUrl?: string
    // start: number
    // duration: number
    adaptationSets: AdaptationSet[]
  }

  export interface AdaptationSet {
    __original: Manifest.AdaptationSet
    baseUrl?: string
    mimeType?: string
    representations: Representation[]
    contentProtections?: ContentProtection[]
    lang?: string
  }

  export interface Representation {
    __original: Manifest.Representation
    baseUrl?: string
    id: string
    bandwidth: number
    width?: number
    height?: number
    segmentTemplate?: SegmentTemplate
    frameRate?: string
    codecs?: string
    audioSamplingRate?: string
    mimeType?: string
  }

  export interface ContentProtection {
    __original: Manifest.ContentProtection
    schemeIdUri: string
    value?: string
    'cenc:default_KID'?: string
    'xmlns:cenc'?: string
    'cenc:pssh'?: { [key: string]: string }[]
    'mspr:pro'?: { [key: string]: string }[]
  }

  export interface SegmentTemplate {
    __original: Manifest.SegmentTemplate
    media: string
    timescale: number
    segmentTimeline?: SegmentTimeline
    initialization?: string
    startNumber?: number
    duration?: number
  }

  export interface SegmentTimeline {
    __original: Manifest.SegmentTimeline
    segments: Segment[]
  }

  export interface Segment {
    __original: Manifest.Segment
    t?: number
    r?: number
    d: number
  }
}

export namespace Manifest {
  export interface Common {
    [key: string]: string | unknown[] | undefined
  }

  export interface Mpd extends Common {
    xmlns: string
    profiles: string
    minBufferTime: string
    Period: Period[]
    type?: string
    mediaPresentationDuration?: string
    BaseURL?: string
  }

  export interface Period extends Common {
    start?: string
    duration?: string
    BaseURL?: string
    AdaptationSet: AdaptationSet[]
    id?: string
  }

  export interface AdaptationSet extends Common {
    mimeType?: string
    Representation: Representation[]
    BaseURL?: string
    segmentAlignment?: string
    // ContentProtection?: ContentProtection[]
    lang?: string
  }

  export interface ContentProtection extends Common {
    schemeIdUri: string
    value?: string
    'cenc:default_KID'?: string
    'xmlns:cenc'?: string
    'cenc:pssh'?: { [key: string]: string }[]
    'mspr:pro'?: { [key: string]: string }[]
  }

  export interface Representation extends Common {
    id: string
    bandwidth: string
    width?: string
    height?: string
    BaseURL?: string
    SegmentBase?: SegmentBase[]
    SegmentList?: SegmentList[]
    SegmentTemplate?: SegmentTemplate[]
    frameRate?: string
    mimeType?: string
    sar?: string
    scanType?: string
    codecs?: string
    audioSamplingRate?: string
  }

  export interface SegmentBase extends Common {
    RepresentationIndex: RepresentationIndex[]
  }

  export interface RepresentationIndex extends Common {
    sourceURL: string
  }

  export interface SegmentList extends Common {
    timescale: string
    duration: string
    RepresentationIndex: RepresentationIndex[]
    SegmentURL: SegmentURL[]
  }

  export interface SegmentURL extends Common {
    media: string
  }

  export interface SegmentTemplate extends Common {
    media: string
    timescale: string
    RepresentationIndex?: RepresentationIndex[]
    SegmentTimeline?: SegmentTimeline[]
    initialization?: string
    startNumber?: string
    duration?: string
  }

  export interface SegmentTimeline extends Common {
    S: Segment[]
  }

  export interface Segment extends Common {
    t?: string
    r?: string
    d?: string
  }
}
