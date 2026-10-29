import {spawnSync} from 'node:child_process'
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {expect, test} from 'vitest'

const script = new URL('./local-auth-password-policy.mjs', import.meta.url).pathname

function fakeDocker(mode: string) {
  const dir = mkdtempSync(join(tmpdir(), 'oneliner-auth-policy-'))
  const command = join(dir, 'docker')
  writeFileSync(command, [
    '#!/usr/bin/env node',
    "const {appendFileSync} = require('node:fs')",
    "const args = process.argv.slice(2)",
    "appendFileSync(process.env.FAKE_DOCKER_LOG, args.join(' ') + '\\n')",
    "if (process.env.FAKE_DOCKER_MODE === 'hang') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30000)",
    "if (args[0] === 'inspect') {",
    "  if (args[1].includes('before_password_policy')) {console.error('no such object'); process.exit(1)}",
    "  console.log(process.env.FAKE_DOCKER_INSPECT)",
    "} else if (args[0] === 'rename') {console.error('rename failed'); process.exit(1)}",
  ].join('\n'))
  chmodSync(command, 0o755)
  const inspect = {
    Name: '/supabase_auth_oneliner', Image: 'same-image', State: {Health: {Status: 'healthy'}},
    Config: {Image: 'public.ecr.aws/supabase/gotrue:v2.197.0', Cmd: ['auth'], Env: ['A=one'], Labels: {'com.supabase.cli.project': 'oneliner', 'com.docker.compose.project': 'oneliner'}, Healthcheck: {Test: ['CMD-SHELL', 'true'], Interval: 1e10, Timeout: 2e9, Retries: 3}},
    HostConfig: {NetworkMode: 'supabase_network_oneliner', Binds: null, Mounts: null, PortBindings: {}, RestartPolicy: {Name: 'unless-stopped'}},
    NetworkSettings: {Networks: {supabase_network_oneliner: {}}},
  }
  const run = (action: string) => spawnSync(process.execPath, [script, action], {
    encoding: 'utf8', timeout: 7000,
    env: {...process.env, PATH: dir + ':' + process.env.PATH, FAKE_DOCKER_MODE: mode, FAKE_DOCKER_LOG: join(dir, 'calls.log'), FAKE_DOCKER_INSPECT: JSON.stringify([inspect])},
  })
  return {dir, run, calls: () => readFileSync(join(dir, 'calls.log'), 'utf8')}
}

test('stalled Docker inspection terminates with an error', () => {
  const fake = fakeDocker('hang')
  try {
    const result = fake.run('check')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/ETIMEDOUT|timed out/i)
  } finally {rmSync(fake.dir, {recursive: true, force: true})}
}, 10_000)

test('failed rename restarts the original Auth container', () => {
  const fake = fakeDocker('rename-fails')
  try {
    const result = fake.run('apply')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('rename failed')
    const calls = fake.calls().split('\n')
    expect(calls).toContain('stop supabase_auth_oneliner')
    expect(calls).toContain('start supabase_auth_oneliner')
    expect(calls.indexOf('stop supabase_auth_oneliner')).toBeLessThan(calls.indexOf('rename supabase_auth_oneliner supabase_auth_oneliner_before_password_policy'))
    expect(calls.indexOf('rename supabase_auth_oneliner supabase_auth_oneliner_before_password_policy')).toBeLessThan(calls.indexOf('start supabase_auth_oneliner'))
  } finally {rmSync(fake.dir, {recursive: true, force: true})}
})
