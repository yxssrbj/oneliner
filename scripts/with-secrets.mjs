if (Number(process.versions.node.split('.')[0]) < 24 || typeof process.execve !== 'function') {
  console.error('SOPS startup requires Node.js 24 or newer on macOS/Linux.')
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/with-secrets.mjs <command> [arguments...]')
  process.exit(1)
}

// SOPS accepts a shell command; quote every argument and replace the shell.
const command = 'exec ' + args.map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(' ')
process.execve('/usr/bin/env', ['env', 'sops', 'exec-env', '--same-process', 'secrets/app.enc.env', command], process.env)
