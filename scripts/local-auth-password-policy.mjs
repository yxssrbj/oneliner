import {spawnSync} from 'node:child_process'

const name = 'supabase_auth_oneliner'
const backup = `${name}_before_password_policy`
const flag = 'GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD'
const network = 'supabase_network_oneliner'

function docker(...args) {
  const result = spawnSync('docker', args, {encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: args[0] === 'inspect' ? 3000 : 30_000, killSignal: 'SIGTERM'})
  if (result.error || result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${result.error?.message ?? result.stderr.trim()}`)
  return result.stdout.trim()
}

function inspect(container) {
  return JSON.parse(docker('inspect', container))[0]
}

function exists(container) {
  try {inspect(container); return true} catch (error) {
    if (String(error.message).toLowerCase().includes('no such object')) return false
    throw error
  }
}

function validate(container) {
  if (container.Name !== `/${name}` || container.Config.Labels?.['com.supabase.cli.project'] !== 'oneliner' ||
      container.Config.Labels?.['com.docker.compose.project'] !== 'oneliner' ||
      container.Config.Image !== 'public.ecr.aws/supabase/gotrue:v2.197.0' ||
      container.HostConfig.NetworkMode !== network ||
      Object.keys(container.NetworkSettings.Networks).join() !== network ||
      container.HostConfig.Binds?.length || container.HostConfig.Mounts?.length ||
      Object.keys(container.HostConfig.PortBindings ?? {}).length ||
      container.Config.Cmd?.join() !== 'auth' ||
      container.Config.Healthcheck?.Test?.[0] !== 'CMD-SHELL') {
    throw new Error('Auth container differs from the supported local Oneliner setup; no change made.')
  }
}

function enabled(container) {
  const values = container.Config.Env.filter(entry => entry.startsWith(`${flag}=`))
  return values.length === 1 && values[0] === `${flag}=true`
}

function healthy() {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (inspect(name).State.Health?.Status === 'healthy') return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
  }
  throw new Error('Replacement Auth container did not become healthy.')
}

function restore() {
  const current = inspect(name)
  validate(current)
  if (!enabled(current)) throw new Error('Current Auth container is not the policy replacement; no change made.')
  const original = inspect(backup)
  if (original.Config.Labels?.['com.supabase.cli.project'] !== 'oneliner') throw new Error('Backup is not the local Oneliner Auth container.')
  docker('stop', name)
  docker('rm', name)
  docker('rename', backup, name)
  docker('start', name)
  healthy()
}

const action = process.argv[2]
try {
  if (!['check', 'apply', 'rollback'].includes(action)) throw new Error('Use check, apply, or rollback.')
  if (action === 'rollback') {
    restore()
    console.log('Local Auth configuration restored from the preserved container.')
  } else {
    const current = inspect(name)
    validate(current)
    if (action === 'check') {
      if (!enabled(current) || current.State.Health?.Status !== 'healthy') throw new Error('Local Auth current-password policy is absent or unhealthy. Run: node scripts/local-auth-password-policy.mjs apply')
      console.log('Local Auth current-password policy is enabled and healthy.')
    } else if (enabled(current)) {
      healthy()
      console.log('Local Auth current-password policy is already enabled.')
    } else {
      if (exists(backup)) throw new Error('A preserved Auth container already exists; inspect it before applying.')
      if (current.State.Health?.Status !== 'healthy') throw new Error('Local Auth is unhealthy; no change made.')
      const env = Object.fromEntries(current.Config.Env.map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]))
      env[flag] = 'true'
      const health = current.Config.Healthcheck
      const args = ['create', '--name', name, '--network', network, '--network-alias', 'auth', '--restart', current.HostConfig.RestartPolicy.Name,
        '--health-cmd', health.Test[1], '--health-interval', `${health.Interval}ns`, '--health-timeout', `${health.Timeout}ns`, '--health-retries', String(health.Retries)]
      for (const [key, value] of Object.entries(current.Config.Labels)) args.push('--label', `${key}=${value}`)
      for (const key of Object.keys(env)) args.push('--env', key)
      args.push(current.Config.Image, 'auth')
      try {
        docker('stop', name)
        docker('rename', name, backup)
        const created = spawnSync('docker', args, {encoding: 'utf8', env: {...process.env, ...env}, timeout: 30_000, killSignal: 'SIGTERM'})
        if (created.error || created.status !== 0) throw new Error(`Docker create failed: ${created.error?.message ?? created.stderr.trim()}`)
        if (inspect(name).Image !== current.Image) throw new Error('Replacement Auth image differs from the original.')
        docker('start', name)
        healthy()
        console.log('Local Auth policy enabled. Original container preserved for rollback; database was untouched.')
      } catch (error) {
        try {
          if (exists(backup)) {
            if (exists(name)) docker('rm', '-f', name)
            docker('rename', backup, name)
          }
          docker('start', name)
        } catch (recoveryError) {
          throw new AggregateError([error, recoveryError], 'Could not restore the original Auth container.')
        }
        throw error
      }
    }
  }
} catch (error) {
  console.error(error.message, ...(error instanceof AggregateError ? error.errors.map(cause => cause.message) : []))
  process.exitCode = 1
}
