import * as yargs from 'yargs'
import { dispatch } from './providers/dispatch'
import { isErrorPayload } from './utils/error'

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
    .help('h')
    .alias('h', 'help')
    .parse()
  )

  const { outputPath, type } = argv
  const inputUrl = argv._[0]
  try {
    const inputType = type === 'livechat' ? 'livechat' : 'video'
    const run = dispatch(inputUrl, { projectPath: outputPath })
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
