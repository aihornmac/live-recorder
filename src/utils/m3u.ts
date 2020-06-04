const propertyReg = /^"?([^"]+?)"?="?([^"]+?)"?$/
const propertyRegGlobal = new RegExp(propertyReg, 'g')

export function parseM3U(content: string): M3U {
  const lines = content.split(/[\r\n]/).filter(Boolean).map(x => x.trim())
  if (lines[0] !== '#EXTM3U') {
    throw new Error(`the first line must be #EXTM3U`)
  }
  const tracks: M3UTrack[] = []
  const extension: M3UAppleExtension = {}
  let isReadingTrackUrl = false
  for (const line of lines) {
    if (line.startsWith('#')) {
      if (line.startsWith('#EXTINF')) {
        const matchTrackInfo = line.match(/^#EXTINF:([0-9.]+?)\b(.*?)(?:,(.*?))?$/)
        if (!matchTrackInfo) {
          throw new Error(`Cannot parse extinf ${JSON.stringify(line)}`)
        }
        const propertiesString = matchTrackInfo[2]
        const matchProperties = propertiesString.match(propertyRegGlobal)
        const properties: { [key: string]: string } = {}
        if (matchProperties) {
          for (const str of matchProperties) {
            const matchProperty = str.trim().match(propertyReg)!
            const key = matchProperty[1]
            const value = matchProperty[2]
            properties[key] = value
          }
        }
        const title = matchTrackInfo[3]
        tracks.push({
          title,
          duration: +matchTrackInfo[1],
          url: '',
          properties: {},
        })
        isReadingTrackUrl = true
      } else {
        isReadingTrackUrl = false

        if (line.startsWith('#EXT-X-')) {
          const matchKeyValue = line.match(/^#EXT-X-(.*?):(.*?)$/)
          if (!matchKeyValue) {
            throw new Error(`Cannot parse ext-x ${JSON.stringify(line)}`)
          }
          const key = matchKeyValue[1]
          const value = matchKeyValue[2]
          if (key === 'VERSION') {
            extension.version = +value
          } else if (key === 'TARGETDURATION') {
            extension.targetDuration = +value
          } else if (key === 'MEDIA-SEQUENCE') {
            extension.mediaSequence = +value
          } else if (key === 'PROGRAM-DATE-TIME') {
            extension.programeDataTime = new Date(value)
          } else {
            const map = extension.unknown || (extension.unknown = {})
            map[key] = value
          }
        }
      }
    } else {
      const track = tracks[tracks.length - 1]
      if (!isReadingTrackUrl || !track) {
        throw new Error(`Is not reaodnly track url`)
      }
      isReadingTrackUrl = false
      track.url = line.trim()
    }
  }
  return {
    tracks,
    extension,
  }
}

export interface M3U {
  tracks: M3UTrack[]
  extension: M3UAppleExtension
}

export interface M3UAppleExtension {
  version?: number
  targetDuration?: number
  mediaSequence?: number
  programeDataTime?: Date
  unknown?: {
    [key: string]: string
  }
}

export interface M3UTrack {
  title: string,
  duration: number
  url: string
  properties: {
    [key: string]: string
  }
}
