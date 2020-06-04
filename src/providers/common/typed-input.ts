import { ApplicationError, fail } from '../../utils/error'

export interface CommonCreateOptions {
  readonly projectPath?: string
}

export interface ParsedProviderInfo<TName, TData = undefined> {
  kind: 'parsed provider info'
  provider: TName
  data: TData
}

export function createProviderInfo<TName>(provider: TName, data?: undefined | void): ParsedProviderInfo<TName>
export function createProviderInfo<TName, TData = undefined>(provider: TName, data: TData): ParsedProviderInfo<TName, TData>
export function createProviderInfo<TName, TData = undefined>(provider: TName, data: TData): ParsedProviderInfo<TName, TData> {
  return {
    kind: 'parsed provider info',
    provider,
    data,
  }
}

export interface ProviderMismatchError<TData = undefined> extends ApplicationError<'provider mismatch', TData> {}

export function failProviderMismatch(provider: string, data?: undefined | void): ProviderMismatchError
export function failProviderMismatch<TData = undefined>(provider: string, data: TData): ProviderMismatchError<TData>
export function failProviderMismatch<TData = undefined>(provider: string, data: TData): ProviderMismatchError<TData> {
  return fail(
    'provider mismatch',
    `The given url is not provider ${JSON.stringify(provider)}`,
    data,
  )
}

export interface ProviderInvalidError<TData = undefined> extends ApplicationError<'provider invalid', TData> {}

export function failProviderInvalid(provider: string, reason?: string, data?: undefined | void): ProviderInvalidError
export function failProviderInvalid<TData = undefined>(provider: string, reason: string | undefined | void, data: TData): ProviderInvalidError<TData>
export function failProviderInvalid<TData = undefined>(provider: string, reason: string | undefined | void, data: TData): ProviderInvalidError<TData> {
  return fail(
    'provider invalid',
    typeof reason === 'string' ? reason : (
      `The given url doesn't match provider ${JSON.stringify(provider)}`
    ),
    data,
  )
}
