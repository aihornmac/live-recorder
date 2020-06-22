import * as yargs from 'yargs'
import { parseDate } from 'chrono-node'
import { formatDistance } from 'date-fns'
import { dispatch } from './providers/dispatch'
import { isErrorPayload, fail } from './utils/error'
import chalk = require('chalk')
import { later } from './utils/js'

export async function execute() {
  const inputUrl = yargs.help(false).parse()._[0] || ''

  try {
    const provider = dispatch(inputUrl)(
      yargs
      .strict()
      .parserConfiguration({ 'boolean-negation': false })
      .version(false)
      .option('outputPath', {
        type: 'string',
        nargs: 1,
        demandOption: false,
        describe: 'Specify output project path',
      })
      .alias('o', 'outputPath')
      .option('startAt', {
        type: 'string',
        nargs: 1,
        demandOption: false,
        describe: 'Specify record start time based on your local timezone',
      })
    )
    const { startAt, outputPath } = provider.argv()
    let recordStartAt = Date.now()
    if (startAt) {
      const startTime = parseDate(startAt)
      if (!startTime) {
        throw fail(chalk.redBright(`Unable to recognize start time ${startAt.toLocaleString()}`))
      }
      const durationText = formatDistance(startTime, new Date(), { addSuffix: true })
      console.log(chalk.greenBright(`Recording will start at ${startTime}  ( ${durationText} )`))
      recordStartAt = +startTime
    }
    for await (const stage of provider.execute({ projectPath: outputPath })) {
      if (stage === 'prepared') {
        await later(Math.max(0, recordStartAt - Date.now()))
      }
    }
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
