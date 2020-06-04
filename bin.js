#!/usr/bin/env node

bootstrap()

async function bootstrap () {
  try {
    require.resolve('./lib/entry')
  } catch (e) {
    const message = String(e.message)
    if (message.includes('Cannot find module')) {
      const packageJson = require('./package.json')
      console.error(`Entry file is not detected, please make sure ${packageJson.name} is built`)
    } else {
      console.error(e)
    }
    process.exit(1)
  }

  try {
    await require('./lib/entry').execute()
  } catch (e) {
    console.error(e)
    process.exit(1)
  }

  process.exit(0)
}
