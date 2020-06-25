import * as yargs from 'yargs'
import { parseDate } from 'chrono-node'
import { formatDistance } from 'date-fns'
import * as dispatch from './providers/dispatch'
import { isErrorPayload, fail } from './utils/error'
import * as chalk from 'chalk'
import { later } from './utils/js'
import { version } from './env'

export async function execute() {
  const initialArgvDef = (
    yargs
    .parserConfiguration({ 'boolean-negation': false })
    .version(version)
    .alias('v', 'version')
    .alias('h', 'help')
  )

  const initialArgv = (
    initialArgvDef
    .help(false)
    .option('help', {
      type: 'boolean',
      nargs: 0,
      demandOption: false,
    })
    .parse()
  )

  const firstInput = initialArgv._[0] || ''

  if (!firstInput && initialArgv.help) {
    initialArgvDef.help().parse()
  }

  try {
    // try to execute commander
    {
      const provider = firstInput.toLocaleLowerCase()
      const commander = dispatch.commands(provider)
      if (commander) {
        const list = process.argv.slice(2)
        const firstInputIndex = list.findIndex(x => x === firstInput)
        if (firstInputIndex >= 0) {
          list.splice(0, firstInputIndex + 1)
        }
        return await commander(list, initialArgvDef)
      }
    }

    // execute recorder
    {
      const recorder = dispatch.record(firstInput)(
        initialArgvDef
        .help()
        .strict()
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
      const { startAt, outputPath } = recorder.argv()
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
      for await (const stage of recorder.execute({ projectPath: outputPath })) {
        if (stage === 'prepared') {
          await later(Math.max(0, recordStartAt - Date.now()))
        }
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
