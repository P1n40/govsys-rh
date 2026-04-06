import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

config({ path: '.env.local' })
config()
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public'

export default defineConfig({
  schema: 'prisma/schema.prisma',
})
