import { ErrorPayload } from '../types'

export function fail(message: string): ApplicationError<'string'>
export function fail<TCode extends string>(code: TCode, message: string | undefined): ApplicationError<TCode>
export function fail<TCode extends string, TData = void>(code: TCode, message: string | undefined, data: TData): ApplicationError<TCode, TData>
export function fail<TCode extends string, TData = void>(...args: [string] | [TCode, string | undefined] | [TCode, string | undefined, TData]): ApplicationError<TCode, TData> {
  const { code, message, data } = (() => {
    if (args.length === 3) {
      const [code, message, data] = args
      return { code, message, data }
    }
    if (args.length === 2) {
      const [code, message] = args
      return { code, message, data: undefined }
    }
    if (args.length === 1) {
      const [ message ] = args
      return { code: 'string' as TCode, message, data: undefined }
    }
    throw new Error(`Expected 1-3 parameters, ${(args as []).length} given`)
  })()
  const error = new Error(typeof message === 'string' ? message : code) as ApplicationError<TCode, TData>
  error.$isLiveRecorderError = true
  error.kind = 'error'
  error.code = code
  error.data = data!
  return error
}

export interface ApplicationError<TCode, TData = void> extends Error, ErrorPayload<TCode, TData> {
  kind: 'error'
}

export function isErrorPayload(x: unknown): x is ErrorPayload<unknown, unknown> {
  return Boolean(typeof x === 'object' && x && (x as Partial<ErrorPayload<unknown, unknown>>).$isLiveRecorderError === true)
}
