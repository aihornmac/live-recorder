// tslint:disable max-line-length no-big-function

import * as inquirer from 'inquirer'
import * as _ from 'lodash'
export interface SelectOptionLike {
  name: string
  value: string
}

export async function select<T extends SelectOptionLike>(
  message: string,
  options: Pick<inquirer.ListQuestionOptions, 'filter' | 'validate'> & {
    choices?: readonly T[]
  } = {}
) {
  const result = await inquirer.prompt({
    ...options,
    type: 'list',
    name: 'result',
    message,
  })
  return result.result as T['value']
}

export async function confirm(message: string) {
  const result = await inquirer.prompt({
    type: 'expand',
    name: 'confirm',
    message,
    default: 2, // default to help in order to avoid clicking straight through
    choices: [{ key: 'y', name: 'Yes', value: true }, { key: 'n', name: 'No', value: false }],
  })
  return result.confirm as boolean
}

export async function input(message: string, options: Pick<inquirer.InputQuestionOptions, 'filter' | 'validate'> = {}) {
  const result = await inquirer.prompt({
    ...options,
    type: 'input',
    name: 'input',
    message,
  })
  return result.input as string
}
