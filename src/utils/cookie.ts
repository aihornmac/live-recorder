import { parse, serialize } from 'cookie'

export function mergeCookie(strList: string[]) {
  const result: { [key: string]: string } = {}
  for (const str of strList) {
    Object.assign(result, parseCookie(str))
  }
  return stringifyCookie(result)
}

export function parseCookie(setcookie: string) {
  const obj = parse(setcookie)
  delete obj.path
  delete obj.expires
  return obj
}

export function stringifyCookie(obj: { readonly [key: string]: string }) {
  return Object.entries(obj).map(([key, value]) => serialize(key, value)).join('; ')
}
