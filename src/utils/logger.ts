import { isErrorPayload } from './error'

export function printError(error: unknown) {
  if (isErrorPayload(error)) {
    error.message
  }
}
