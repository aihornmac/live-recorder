import { parse, serialize } from 'cookie'

export function mergeCookie(strList: string[]) {
  const result: { [key: string]: string } = {}
  for (const str of strList) {
    const obj = parse(str)
    delete obj.path
    delete obj.expires
    Object.assign(result, obj)
  }
  return Object.entries(result).map(([key, value]) => serialize(key, value)).join('; ')
}
