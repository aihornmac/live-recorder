import * as path from 'path'
import { ensure } from '../../utils/flow-control'
import { get } from '../../utils/request'
import { isObjectHasKey } from '../../utils/js'

const CONTENT_TYPE_MAP = {
  'video/3gpp': '3gp',
  'video/f4v': 'flv',
  'video/mp4': 'mp4',
  'video/MP2T': 'ts',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-flv': 'flv',
  'video/x-ms-asf': 'asf',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
} as const

export async function getStreamingUrlInfo(url: string) {
  const res = await ensure(() => get(url))
  const headers: { readonly [key: string]: string | undefined } = res.headers
  console.log(headers)

  const size = headers['transfer-encoding'] === 'chunked' ? undefined : Number(headers['content-length']) || 0

  let type = headers['content-type'] || ''
  // fix for netease
  if (type === 'image/jpg; charset=UTF-8' || type === 'image/jpg') {
    type = 'audio/mpeg'
  }

  const ext = isObjectHasKey(CONTENT_TYPE_MAP, type) ? CONTENT_TYPE_MAP[type] : (() => {
    const filenameMatch = (headers['content-disposition'] || '').match(/filename="?([^"]+)"?/)
    if (filenameMatch) {
      const filename = filenameMatch[1]
      return path.extname(filename).slice(1)
    }
    return ''
  })()

  return { type, ext, size }
}
