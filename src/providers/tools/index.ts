import * as path from 'path'
import * as fs from 'fs'
import * as chalk from 'chalk'
import * as minimatch from 'minimatch'

import { failProviderMismatch } from '../common/typed-input'
import { argv } from '../../utils/argv'
import { fail } from '../../utils/error'
import { exists } from '../../utils/fs'
import { confirm } from '../../utils/prompt'
import { call } from '../../utils/js'
import { ProgressBar } from '../../utils/progress-bar'
import { Merge } from './merge'

export async function commands(list: readonly string[]) {
  const command = list[0] || ''
  const rest = list.slice(1)
  if (command === 'merge') {
    return executeMerge(rest)
  }
}

export function match() {
  return failProviderMismatch('tools')
}

async function executeMerge(list: readonly string[]) {
  const parsed = (
    argv()
      .onlyDefinedOptions()
      .option({
        name: 'help',
        type: 'boolean',
      })
      .option({
        name: 'filter',
        type: 'string',
      })
      .option({
        name: 'start',
        type: 'string',
      })
      .option({
        name: 'end',
        type: 'string',
      })
      .option({
        name: 'yes',
        type: 'boolean',
      })
      .alias('h', 'help')
      .alias('y', 'yes')
      .parseOrExit(list)
  )

  const { options } = parsed

  if (options.help) {
    console.log(chalk.greenBright(`tools merge <chunks path> <output file path>`))
    return
  }

  const { commands } = parsed

  if (commands.length !== 2) {
    throw fail(chalk.redBright(`Expect <chunks path> <output file path>, got ${commands.length} inputs`))
  }

  const filter = createFilter(options.filter)
  const matchStart = createFilter(options.start)
  const matchEnd = createFilter(options.end)

  const chunksPath = path.resolve(process.cwd(), commands[0])
  const outputPath = path.resolve(process.cwd(), commands[1])

  // make sure chunks path refers to a directory

  const chunksPathStat = await exists(chunksPath)
  if (!chunksPathStat) {
    throw fail(chalk.redBright(`chunks path ${JSON.stringify(chunksPath)} not found`))
  }
  if (!chunksPathStat.isDirectory()) {
    throw fail(chalk.redBright(`chunks path ${JSON.stringify(chunksPath)} is not a directory`))
  }

  // get filtered file names in chunks path

  const fileNameToIdMap = new Map<string, number>()
  const idToFileNameMap = new Map<number, string>()
  let areFileNamesNumeric = false

  const fileNames = await call(async () => {
    const allList = await fs.promises.readdir(chunksPath)
    const filteredList = allList.filter(x => filter.match(x))
    if (!filteredList.length) {
      throw fail(chalk.redBright(`no chunks found`))
    }
    for (const fileName of filteredList) {
      const id = +path.basename(fileName, path.extname(fileName))
      if (Number.isFinite(id)) {
        if (idToFileNameMap.has(id)) {
          throw fail(`id duplicated: ${JSON.stringify(fileName)}, ${JSON.stringify(idToFileNameMap.get(id))}`)
        }
        fileNameToIdMap.set(fileName, id)
        idToFileNameMap.set(id, fileName)
      }
    }
    areFileNamesNumeric = filteredList.every(x => fileNameToIdMap.has(x))
    if (areFileNamesNumeric) {
      // all file names are numeric, sort by id asc
      return filteredList.sort((a, b) => fileNameToIdMap.get(a)! - fileNameToIdMap.get(b)!)
    }
    return filteredList
  })

  // slice file names

  const startIndex = call(() => {
    if (areFileNamesNumeric) {
      const value = Number(options.start)
      if (Number.isFinite(value) && idToFileNameMap.has(value)) {
        return fileNames.indexOf(idToFileNameMap.get(value)!)
      }
    }
    return fileNames.findIndex(x => matchStart.match(x))
  })
  if (startIndex < 0) {
    throw fail(chalk.redBright(`start ${JSON.stringify(options.start)} not found`))
  }

  const endIndex = call(() => {
    if (areFileNamesNumeric) {
      const value = Number(options.end)
      if (Number.isFinite(value) && idToFileNameMap.has(value)) {
        return fileNames.indexOf(idToFileNameMap.get(value)!) + 1
      }
    }
    return fileNames.length - fileNames.slice().reverse().findIndex(x => matchEnd.match(x))
  })
  if (endIndex > fileNames.length) {
    throw fail(chalk.redBright(`end ${JSON.stringify(options.start)} not found`))
  }

  if (startIndex >= endIndex) {
    throw fail(chalk.redBright(`sliced chunks is empty`))
  }

  const fileNamesSlice = fileNames.slice(startIndex, endIndex)

  // print slice edges

  const startFileName = fileNamesSlice[0]
  const endFileName = fileNamesSlice[fileNamesSlice.length - 1]
  console.log(`merge from ${JSON.stringify(startFileName)} to ${JSON.stringify(endFileName)}`)

  // make sure output path is writable

  const outputPathStat = await exists(outputPath)
  if (outputPathStat) {
    if (outputPathStat.isDirectory()) {
      throw fail(`output path ${JSON.stringify(outputPath)} is a directory`)
    }
    if (!options.yes) {
      const shouldOverride = await confirm(`${JSON.stringify(outputPath)} existed, do you want to override it?`)
      if (!shouldOverride) return
    }
  }

  // merge chunks

  const progressBar = new ProgressBar({
    smooth: 100,
    freshRate: 5,
  })

  progressBar.start()

  const mergeExecution = new Merge({
    outputPath,
    chunksPath,
    fileNames: fileNamesSlice,
  })

  mergeExecution.events.on('increase progress', value => progressBar.increaseValue(value))
  mergeExecution.events.on('increase total', value => progressBar.increaseTotal(value))

  mergeExecution.start()

  await mergeExecution.exaust()

  progressBar.stop()
}

function createFilter(input?: string | null) {
  return new minimatch.Minimatch(input || '*', {
    matchBase: true,
    // dotfiles inside ignored directories should also match
    dot: !!input,
  })
}
