import { afterAll, beforeAll, expect, test } from 'vitest'
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const wrapper = resolve('scripts/with-secrets.mjs')
const scratch = mkdtempSync(join(tmpdir(), 'oneliner-sops-'))
const identity = join(scratch, 'identity.txt')
const env: NodeJS.ProcessEnv = { ...process.env, SOPS_AGE_KEY_FILE: identity, XDG_CONFIG_HOME: scratch }
delete env.SOPS_AGE_KEY
delete env.SOPS_AGE_KEY_CMD
const run = (args: string[], overrides = {}) => spawnSync(process.execPath, [wrapper, ...args], {
  cwd: scratch, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 5000,
})

beforeAll(() => {
  mkdirSync(join(scratch, 'secrets'))
  const key = spawnSync('age-keygen', ['-o', identity], { encoding: 'utf8', timeout: 5000 })
  expect(key.status).toBe(0)
  const recipient = spawnSync('age-keygen', ['-y', identity], { encoding: 'utf8', timeout: 5000 })
  expect(recipient.status).toBe(0)
  const encrypted = spawnSync('sops', ['encrypt', '--age', recipient.stdout.trim(), '--input-type', 'dotenv', '--output-type', 'dotenv', '/dev/stdin'], {
    cwd: scratch, input: 'ONELINER_SYNTHETIC_VALUE=synthetic-test-only\n', encoding: 'utf8', timeout: 5000,
  })
  expect(encrypted.status, encrypted.stderr).toBe(0)
  writeFileSync(join(scratch, 'secrets/app.enc.env'), encrypted.stdout)
})
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

test('ordinary startup scripts wrap runtime commands only', () => {
  const { scripts, engines } = JSON.parse(readFileSync('package.json', 'utf8'))
  for (const [name, command] of Object.entries({ dev: 'next dev', build: 'next build', start: 'next start', 'test:e2e': 'playwright test' })) {
    if (name === 'test:e2e' && scripts[name] === undefined) continue
    expect(scripts[name]).toBe(`node scripts/with-secrets.mjs ${command}`)
  }
  expect(engines.node).toBe('>=24')
  expect(scripts.test).toBe('vitest run')
  expect(scripts.lint).toBe('eslint')
  expect(scripts.typecheck).toBe('next typegen && tsc --noEmit')
})

test('decrypts into the child environment and preserves literal arguments', () => {
  const args = ['--port', '3100', 'space value', "quote'\"", '$(touch forbidden); & `touch forbidden`', 'line\nbreak', '']
  const result = run([process.execPath, '-e', 'process.stdout.write(JSON.stringify([process.env.ONELINER_SYNTHETIC_VALUE, process.argv.slice(1)]))', '--', ...args], { ONELINER_SYNTHETIC_VALUE: 'wrong-inherited-value' })
  expect(result.status, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual(['synthetic-test-only', args])
})

test('npm dev forwards appended arguments to the runtime command', () => {
  mkdirSync(join(scratch, 'scripts'))
  mkdirSync(join(scratch, 'bin'))
  writeFileSync(join(scratch, 'scripts/with-secrets.mjs'), readFileSync(wrapper))
  writeFileSync(join(scratch, 'package.json'), readFileSync('package.json'))
  const fakeNext = join(scratch, 'bin/next')
  writeFileSync(fakeNext, `#!${process.execPath}\nprocess.stdout.write('RESULT:'+JSON.stringify([process.env.ONELINER_SYNTHETIC_VALUE, process.argv.slice(2)])+'\\n')\n`)
  chmodSync(fakeNext, 0o700)
  const result = spawnSync('npm', ['run', 'dev', '--', '--port', '3100', 'space value', "quote'\";$(false)"], {
    cwd: scratch, env: { ...env, PATH: `${join(scratch, 'bin')}:${env.PATH}` }, encoding: 'utf8', timeout: 5000,
  })
  expect(result.status, result.stderr).toBe(0)
  const line = result.stdout.split('\n').find((value) => value.startsWith('RESULT:'))
  expect(JSON.parse(line!.slice(7))).toEqual(['synthetic-test-only', ['dev', '--port', '3100', 'space value', "quote'\";$(false)"]])
})

test('rejects an empty command without starting anything', () => {
  const result = run([])
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('Usage:')
})

test('preserves child failure status', () => {
  expect(run([process.execPath, '-e', 'process.exit(37)']).status).toBe(37)
})

test('fails closed when identity or ciphertext is missing', () => {
  const command = [process.execPath, '-e', 'process.stdout.write("CHILD_RAN")']
  const noKey = run(command, { SOPS_AGE_KEY_FILE: join(scratch, 'missing-key') })
  expect(noKey.status).not.toBe(0)
  expect(noKey.stdout).not.toContain('CHILD_RAN')
  const noFile = spawnSync(process.execPath, [wrapper, ...command], { cwd: tmpdir(), env, encoding: 'utf8', timeout: 5000 })
  expect(noFile.status).not.toBe(0)
  expect(noFile.stdout).not.toContain('CHILD_RAN')
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  test(`stops the child on ${signal}`, async () => {
    const child = spawn(process.execPath, [wrapper, process.execPath, '-e', 'process.stdout.write(String(process.pid)+"\\n"); setInterval(()=>{},1000)'], { cwd: scratch, env })
    try {
      const pid = await new Promise<number>((resolvePid, reject) => {
        const timer = setTimeout(() => reject(new Error('child readiness timed out')), 5000)
        child.once('error', (error) => { clearTimeout(timer); reject(error) })
        child.stdout.once('data', (data) => { clearTimeout(timer); resolvePid(Number(data.toString().trim())) })
      })
      expect(pid).toBe(child.pid)
      const stopped = new Promise((resolveExit, reject) => {
        const timer = setTimeout(() => reject(new Error('child shutdown timed out')), 2000)
        child.once('exit', (code, received) => { clearTimeout(timer); resolveExit({ code, received }) })
      })
      child.kill(signal)
      expect(await stopped).toEqual({ code: null, received: signal })
      expect(() => process.kill(pid, 0)).toThrow()
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }
  }, 8000)
}
