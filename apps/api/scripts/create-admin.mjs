import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { stdin, stdout } from 'node:process'
import { randomUUID } from 'node:crypto'
import { hashPassword } from '../shared/password-hash.mjs'

const require = createRequire(import.meta.url)
const wranglerCli = join(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js')

function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal so the password can stay hidden.')
  }

  return new Promise((resolve, reject) => {
    const wasRaw = stdin.isRaw
    let value = ''
    stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()

    function finish(error, value) {
      stdin.off('data', onData)
      stdin.setRawMode(wasRaw)
      stdin.pause()
      stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (character === '\u0003' || character === '\u0004') return finish(new Error('Cancelled.'))
        if (character === '\r' || character === '\n') return finish(null, value)
        if (character === '\u007f' || character === '\b') value = Array.from(value).slice(0, -1).join('')
        else if (character >= ' ' && character !== '\u007f') value += character
      }
    }

    stdin.on('data', onData)
  })
}

function quoteSql(value) {
  return `'${value.replaceAll("'", "''")}'`
}

async function main() {
  const target = process.argv.slice(2)
  if (target.length !== 1 || !['--remote', '--local'].includes(target[0])) {
    throw new Error('Choose a database with: npm --prefix apps/api run admin:create -- --remote (or --local)')
  }

  const prompt = createInterface({ input: stdin, output: stdout })
  let account
  try {
    account = (await prompt.question('管理员账号: ')).trim()
  } finally {
    prompt.close()
  }
  if (!account || account.length > 128 || /[\u0000-\u001f\u007f]/.test(account)) {
    throw new Error('Account must be 1–128 characters and cannot contain control characters.')
  }

  const password = await readHidden('管理员密码（输入不显示）: ')
  const confirmation = await readHidden('再次输入密码: ')
  if (password.length < 12 || password.length > 1024) throw new Error('Password must be 12–1024 characters.')
  if (password !== confirmation) throw new Error('Passwords do not match.')

  const id = randomUUID()
  const passwordHash = await hashPassword(password)
  const sql = `
    INSERT INTO users (id, account, password_hash, role)
    SELECT ${quoteSql(id)}, ${quoteSql(account)}, ${quoteSql(passwordHash)}, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM users)
    ON CONFLICT(account) DO NOTHING
    RETURNING id;
  `
  const result = spawnSync(process.execPath, [wranglerCli, 'd1', 'execute', 'soon', target[0], '--command', sql, '--json'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Wrangler could not write to D1.')

  let response
  try {
    response = JSON.parse(result.stdout)
  } catch {
    throw new Error('Could not read Wrangler’s D1 result.')
  }
  const rows = Array.isArray(response)
    ? response.flatMap(statement => Array.isArray(statement?.results) ? statement.results : [])
    : []
  if (!rows.some(row => row?.id === id)) {
    throw new Error('D1 already contains an account, or the account migration has not been applied.')
  }
  stdout.write(`Administrator ${account} created in D1.\n`)
}

main().catch((error) => {
  stdout.write(`Administrator creation failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
