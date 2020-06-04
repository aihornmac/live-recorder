bootstrap()

async function bootstrap () {
  try {
    await require('../src/entry').execute()
  } catch (e) {
    console.error(e)
    process.exit(1)
  }

  process.exit(0)
}
