import * as yargs from 'yargs'
import { parseDate } from 'chrono-node'
import formatDistance from 'date-fns/esm/formatDistance'
import { dispatch } from './providers/dispatch'
import { isErrorPayload, fail } from './utils/error'
import chalk = require('chalk')
import { later } from './utils/js'

export async function execute() {
  const argv = (
    yargs
    .strict()
    .parserConfiguration({ 'boolean-negation': false })
    .option('outputPath', {
      type: 'string',
      nargs: 1,
      demandOption: false,
      describe: 'Specify output project path',
    })
    .alias('o', 'outputPath')
    .option('type', {
      type: 'string',
      nargs: 1,
      demandOption: false,
      describe: 'Specify record type. e.g. video / livechat',
    })
    .option('startAt', {
      type: 'string',
      nargs: 1,
      demandOption: false,
      describe: 'Specify record start time based on your local timezone',
    })
    .help('h')
    .alias('h', 'help')
    .parse()
  )

  const { outputPath, type, startAt } = argv
  const inputUrl = argv._[0]

  try {
    const inputType = type === 'livechat' ? 'livechat' : 'video'
    const run = dispatch(inputUrl, { projectPath: outputPath })
    if (startAt) {
      const startTime = parseDate(startAt)
      if (!startTime) {
        throw fail(chalk.redBright(`Unable to recognize start time ${startAt.toLocaleString()}`))
      }
      const durationText = formatDistance(startTime, new Date(), { addSuffix: true })
      console.log(chalk.greenBright(`Recording will start at ${startTime}  ( ${durationText} )`))
      const startTimestamp = +startTime
      await later(Math.max(0, startTimestamp - Date.now()))
    }
    await run[inputType]()
  } catch (e) {
    if (isErrorPayload(e)) {
      if (e.code === 'string') {
        console.error(e.message)
        process.exit(1)
      }
    }
    throw e
  }
}
