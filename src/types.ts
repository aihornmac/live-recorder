export interface ErrorPayload<TCode, TData = undefined> {
  $isLiveRecorderError: true
  code: TCode
  message: string
  data: TData
}
