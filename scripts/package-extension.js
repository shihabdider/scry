#!/usr/bin/env node
import { mkdir, rm, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
const packageName = manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const outDir = 'dist'
const outFile = join(outDir, `${packageName}-${manifest.version}.zip`)

const extensionPaths = [
  'manifest.json',
  'background.js',
  'popup.html',
  'options.html',
  'icons',
  'src',
]

for (const path of extensionPaths) {
  await stat(path)
}

await mkdir(outDir, { recursive: true })
await rm(outFile, { force: true })

await run('zip', [
  '-X',
  '-r',
  outFile,
  ...extensionPaths,
  '-x',
  '*.DS_Store',
  '__MACOSX/*',
])

console.log(`Wrote ${outFile}`)
console.log('Upload this zip as the Chrome Web Store package. Listing screenshots are in store-assets/.')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        COPYFILE_DISABLE: '1',
      },
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with status ${code}`))
    })
  })
}
