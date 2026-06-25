const path = require('path')
const fs = require('fs')

const command = process.argv[2] || 'up'
const migrationsDir = __dirname

const files = fs.readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.js') && f !== 'run.js')
  .sort()

async function runAll() {
  for (const file of files) {
    console.log(`Running ${command}: ${file}`)
    const migration = require(path.join(migrationsDir, file))
    if (command === 'up') {
      await migration.up()
    } else {
      await migration.down()
    }
  }
  console.log(`All migrations ${command} completed`)
}

runAll().catch((err) => { console.error(err); process.exit(1) })
