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
    .help('h')
    .alias('h', 'help')
    .parse()
  )

  const { outputPath } = argv
  const inputUrl = argv._[0]
  try {
    const run = dispatch(inputUrl, { projectPath: outputPath })
    await run()
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
