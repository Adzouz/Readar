// Applies supabase/migrations to the project in DATABASE_URL (repo root .env.local or .env).
// The URL goes to the Supabase CLI as its --remote argument and is never printed.
// Extra arguments are passed through, e.g. `pnpm db:push --dry-run`.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

for (const name of ['.env.local', '.env']) if (existsSync(name)) process.loadEnvFile(name)
const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error('DATABASE_URL is missing. Add it to the repo root .env.local or .env.')
  process.exit(1)
}
const result = spawnSync('supabase', ['db', 'push', `--remote=${url}`, ...process.argv.slice(2)], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
