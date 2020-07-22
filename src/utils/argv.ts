import { dashToCamel } from './js'
import * as chalk from 'chalk'

export function argv() {
  return Argv.create()
}

class Argv<M extends {} = {}> {
  static create() {
    return new this()
  }

  private constructor(
    readonly options: { readonly [key: string]: InputOption | undefined } = {},
    readonly aliases: { readonly [key: string]: string } = {},
    readonly config: Config = {},
  ) {}

  onlyDefinedOptions(enable = true): Argv<M> {
    return new Argv(
      this.options,
      this.aliases,
      { ...this.config, onlyDefinedOptions: Boolean(enable) || undefined },
    )
  }

  option<TType extends 'string', TName extends string, TRequired extends boolean = false>(
    def: InputOption<TName, TType, TRequired>
  ): Argv<M & (
    TRequired extends true ? {
      [P in TName]: string
    } : {
      [P in TName]?: string | null
    }
  )>
  option<TType extends 'number', TName extends string, TRequired extends boolean = false>(
    def: InputOption<TName, TType, TRequired>
  ): Argv<M & (
    TRequired extends true ? {
      [P in TName]: number
    } : {
      [P in TName]?: number | null
    }
  )>
  option<TType extends 'boolean', TName extends string, TRequired extends boolean = false>(
    def: InputOption<TName, TType, TRequired>
  ): Argv<M & (
    TRequired extends true ? {
      [P in TName]: boolean
    } : {
      [P in TName]?: boolean | null
    }
  )>
  option(def: InputOption): Argv<{}> {
    return new Argv(
      { ...this.options, [def.name]: def },
      this.aliases,
      this.config,
    )
  }

  alias<K extends keyof M & string>(shortName: string, longName: K): Argv<M> {
    return new Argv(
      this.options,
      {
        ...this.aliases,
        [shortName]: longName,
      },
      this.config,
    )
  }

  parse(argv: readonly string[], parseOptions: ParseOptions = {}): ParsedResult<M> {
    const { options, aliases, config } = this
    const beforeCommands = Boolean(parseOptions.beforeCommands)
    const result: { [key: string]: string | boolean | number | null } = Object.create(null)
    const commands: string[] = []
    const rest: string[] = []
    const items = parseArgv(argv)
    let prevOption: InputOption | undefined
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'option') {
        // current item is option

        if (beforeCommands && commands.length > 0) {
          rest.push(...argv.slice(i))
          break
        }

        if (prevOption) {
          // prev option is given, now it should be given null
          if (prevOption.required) {
            // throw if prev option is required and not boolean
            return fail('option required')
          }
          prevOption = undefined
        }

        const { value } = item
        const name = aliases[item.name] || item.name
        const option = options[name]
        if (option) {
          // option is defined
          if (option.type === 'boolean') {
            const validated = value === undefined ? null : parseBoolean(value)
            if (validated === undefined || validated === null) {
              result[name] = true
            } else {
              result[name] = validated
            }
          } else {
            // string or boolean
            if (value === undefined) {
              result[name] = null
            } else {
              const validated = parseType(value, option.type)
              if (validated === undefined) {
                return fail('wrong input type')
              }
              result[name] = validated
            }
            if (!option.onlyPositional) {
              prevOption = option
            }
          }
        } else {
          // option is not defined
          if (config.onlyDefinedOptions) {
            return fail('unknown option')
          }
          result[name] = typeof value === 'string' ? parseAny(value) : null
        }
      } else {
        // current item is input
        if (prevOption) {
          const option = prevOption
          const { name } = option
          const value = item.raw
          const validated = parseType(value, option.type)
          if (validated === undefined) {
            return fail('wrong input type')
          }
          if (validated === null && option.required) {
            return fail('option required')
          }
          result[name] = validated
          prevOption = undefined
        } else {
          commands.push(item.raw)
        }
      }

      function fail(error: ParseErrorType) {
        return {
          kind: 'failure' as const,
          index: i,
          item: item.raw,
          option: item.kind === 'option' ? options[item.name] : prevOption,
          error,
        }
      }
    }

    if (prevOption) {
      // prev option is given, now it should be given null
      if (prevOption.required && prevOption.type !== 'boolean') {
        // throw if prev option is required and not boolean
        return {
          kind: 'failure',
          index: items.length,
          item: '',
          option: prevOption,
          error: 'option required',
        }
      }
      prevOption = undefined
    }

    for (const key of Object.keys(options)) {
      const option = options[key]
      if (!option) continue
      const value = result[key]
      if (value === undefined || value === null) {
        if (option.required) {
          return {
            kind: 'failure',
            index: items.length,
            item: '',
            error: 'option required',
          }
        }
      }
    }

    return {
      kind: 'success',
      options: result as M,
      commands,
      rest,
    }
  }

  parseOrExit(argv: readonly string[], parseOptions: ParseOptions = {}): ParsedSuccessResult<M> {
    const parsed = this.parse(argv, parseOptions)
    if (parsed.kind === 'failure') {
      console.error(chalk.redBright(`${parsed.error} at ${parsed.item} (${parsed.index})`))
      process.exit(1)
    }
    return parsed
  }
}

export type { Argv }

export interface ParseOptions {
  readonly beforeCommands?: boolean
}

export interface Config {
  readonly onlyDefinedOptions?: boolean
}

export type ParsedResult<M> = ParsedSuccessResult<M> | ParsedFailureResult

export interface ParsedSuccessResult<M> {
  kind: 'success'
  options: M
  commands: string[]
  rest: string[]
}

export interface ParsedFailureResult {
  kind: 'failure'
  index: number
  item: string
  option?: InputOption,
  error: ParseErrorType
}

export type ParseErrorType = (
  | 'wrong input position'
  | 'wrong input type'
  | 'unknown option'
  | 'option required'
)

export type OptionType = (
  | 'string'
  | 'boolean'
  | 'number'
)

export interface InputOption<
  TName extends string = string,
  TType extends OptionType = OptionType,
  TRequired extends boolean = false,
> {
  readonly name: TName
  readonly type: TType
  readonly required?: TRequired
  readonly onlyPositional?: boolean
}

export type ArgvItem = ArgvItemOption | ArgvItemInput

export interface ArgvItemOption {
  kind: 'option'
  raw: string
  name: string
  value?: string
}

export interface ArgvItemInput {
  kind: 'input'
  raw: string
}

const MATCH_VARIABLES = /^(--?)([a-zA-Z]+?(?:-[a-zA-Z]+?)*)(?:=(.*?))?$/

function parseArgv(argv: readonly string[]): ArgvItem[] {
  const args: ArgvItem[] = []
  for (const str of argv) {
    const ret = parseArgvOption(str)
    if (ret) {
      args.push(...ret)
    } else {
      args.push({
        kind: 'input',
        raw: str,
      })
    }
  }
  return args
}

function parseArgvOption(str: string): ArgvItemOption[] | false {
  const match = str.match(MATCH_VARIABLES)
  if (!match) return false
  const name = match[2]
  const value = match[3]
  if (match[1] === '--') {
    // long variable
    return [{
      kind: 'option',
      name: dashToCamel(name),
      value,
      raw: str,
    }]
  }
  const list: ArgvItemOption[] = name.split('').map(x => ({
    kind: 'option',
    name: x,
    raw: str,
  }))
  list[list.length - 1].value = value
  return list
}

function parseAny(x: string) {
  if (x === 'NaN') return NaN
  const lower = x.toLocaleLowerCase()
  if (lower === 'true') return true
  if (lower === 'false') return false
  const num = +x
  if (!Number.isNaN(num)) return num
  return x
}

function parseType(x: string, type: 'string' | 'number' | 'boolean') {
  if (type === 'boolean') return parseBoolean(x)
  if (type === 'number') parseNumber(x)
  return x
}

function parseNumber(x: string) {
  const num = +x
  if (Number.isNaN(num)) return
  return num
}

function parseBoolean(x: string) {
  if (x === '') return null
  const lower = x.toLocaleLowerCase()
  if (lower === 'true') return true
  if (lower === 'false') return false
  return undefined
}
