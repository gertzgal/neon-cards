// Builds the web app once, then starts one wrangler + a fresh local D1 per Playwright
// worker. Playwright waits on E2E_READY_PORT, which listens only after every stack
// answers /api/health. SIGTERM (how Playwright stops the server) kills each stack's
// process group, including workerd.
import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'

const workers = Number(process.env.E2E_WORKERS ?? 4)
const port = Number(process.env.E2E_PORT ?? 8800)
const readyPort = Number(process.env.E2E_READY_PORT ?? port + workers)
const root = process.cwd()

const groups = []
let stopping = false

function log(label, text) {
  for (const line of String(text).split('\n')) {
    if (line) process.stdout.write(`[e2e:${label}] ${line}\n`)
  }
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), { cwd: root, stdio: 'inherit', env: process.env })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${args.join(' ')} exited ${code}`))
    })
  })
}

function startGroup(label, args) {
  const child = spawn(args[0], args.slice(1), {
    cwd: root,
    env: process.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => log(label, chunk))
  child.stderr.on('data', (chunk) => log(label, chunk))
  child.on('exit', (code) => {
    if (!stopping) {
      log(label, `exited ${code}`)
      shutdown(1)
    }
  })
  groups.push(child.pid)
  return child
}

function shutdown(code) {
  if (stopping) return
  stopping = true
  for (const pid of groups) {
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      // already gone
    }
  }
  process.exit(code)
}

process.on('SIGTERM', () => shutdown(0))
process.on('SIGINT', () => shutdown(0))

async function waitForHealth(p) {
  const deadline = Date.now() + 90_000
  let last = 'not up'
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${p}/api/health`)
      if (res.ok) return
      last = `status ${res.status}`
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    await delay(300)
  }
  throw new Error(`stack on :${p} not ready (${last})`)
}

async function main() {
  if (!Number.isInteger(workers) || workers < 1) throw new Error(`bad E2E_WORKERS: ${workers}`)
  const dist = 'apps/web/dist/index.html'
  if (process.env.E2E_SKIP_BUILD === '1' && existsSync(dist)) {
    log('build', 'using existing apps/web/dist')
  } else {
    await run(['pnpm', 'build'])
  }

  await Promise.all(
    Array.from({ length: workers }, async (_, i) => {
      const p = port + i
      const persist = `.wrangler/e2e-${p}`
      rmSync(`apps/worker/${persist}`, { recursive: true, force: true })
      const inspector = String(9230 + i)
      await run([
        'pnpm',
        '--filter',
        '@neon-cards/worker',
        'exec',
        '--',
        'wrangler',
        'd1',
        'migrations',
        'apply',
        'DB',
        '--local',
        '--persist-to',
        persist,
      ])
      startGroup(String(p), [
        'pnpm',
        '--filter',
        '@neon-cards/worker',
        'exec',
        '--',
        'wrangler',
        'dev',
        '--port',
        String(p),
        '--inspector-port',
        inspector,
        '--ip',
        '127.0.0.1',
        '--var',
        'DEV_RIG:1',
        '--persist-to',
        persist,
      ])
      await waitForHealth(p)
      log(String(p), 'D1 ready')
    }),
  )

  const ready = createServer((req, res) => {
    res.writeHead(req.url === '/ready' ? 200 : 404)
    res.end('ok')
  })
  await new Promise((resolve, reject) => {
    ready.once('error', reject)
    ready.listen(readyPort, '127.0.0.1', resolve)
  })
  log('ready', `${workers} isolated stacks on ${port}..${port + workers - 1}`)
  await new Promise(() => {})
}

main().catch((error) => {
  console.error(error)
  shutdown(1)
})
