import * as zlib from 'zlib'
import { fail } from '../../utils/error'

const TARGET_ID = 12 // swfextract -b "12"
const TARGET_CODE = 87 // swfextract "-b" 12
const HEADER_CWS = 8
const HEADER_RECT = 5
const RECT_NUM = 4
const HEADER_REST = 2 + 2
const BINARY_OFFSET = 6

export async function swfExtract(compressed: Buffer) {
  const buf = await unzip(compressed.slice(HEADER_CWS))

  let offset = 0

	// Skip Rect
	const rectSize = buf[offset] >> 3
	const rectOffset = (HEADER_RECT + RECT_NUM * rectSize + 7) / 8

	offset += rectOffset

	// Skip the rest header
	offset += HEADER_REST

  // Read tags
  for (let i = 0; ; i++) {
    // tag code
    const code = (buf[offset + 1] << 2) + (buf[offset] >> 6)

    // tag length
    let len = buf[offset] & 0x3f

    // Skip tag header
    offset += 2

    // tag length (if long version)
    if (len === 0x3f) {
      len = buf[offset]
      len += buf[offset+1] << 8
      len += buf[offset+2] << 16
      len += buf[offset+3] << 24

      // skip tag lentgh header
      offset += 4
    }

    // Not found...
    if (code === 0) {
      throw fail(`Failed to extract swf`)
    }

    // tag ID
    const id = buf[offset] + (buf[offset+1] << 8)

    // Found?
    if (code === TARGET_CODE && id === TARGET_ID) {
      return buf.slice(offset + BINARY_OFFSET, offset + len)
    }

    offset += len
  }
}

function unzip(buf: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    zlib.unzip(buf, (error, result) => {
      error ? reject(error) : resolve(result)
    })
  })
}
