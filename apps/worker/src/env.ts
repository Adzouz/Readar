import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The repo root .env or .env.local (both gitignored) hold DATABASE_URL and friends.
// Real env vars win, then .env.local, then .env.
for (const name of ['.env.local', '.env']) {
  const file = fileURLToPath(new URL(`../../../${name}`, import.meta.url))
  if (existsSync(file)) process.loadEnvFile(file)
}

export function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `${name} is missing. Add it to the repo root .env or .env.local (see .env.example).`,
    )
  }
  return value
}

export const optional = (name: string): string | undefined => process.env[name]?.trim() || undefined
