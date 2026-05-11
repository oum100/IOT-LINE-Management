import { randomUUID } from 'node:crypto'
import { prisma } from './prisma'

type PlatformBootstrapAuditInput = {
  action: 'BOOTSTRAP_ADMIN_CREATED' | 'BOOTSTRAP_ADMIN_PROMOTED'
  bootstrapMode: 'first-time' | 'admin-managed'
  userId: string
  email: string
  actorUserId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}

export async function addPlatformBootstrapAuditLog(input: PlatformBootstrapAuditInput) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_bootstrap_audit_logs (
      id text PRIMARY KEY,
      action text NOT NULL,
      bootstrap_mode text NOT NULL,
      user_id text NOT NULL,
      email text NOT NULL,
      actor_user_id text NULL,
      ip_address text NULL,
      user_agent text NULL,
      metadata jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO platform_bootstrap_audit_logs (
        id,
        action,
        bootstrap_mode,
        user_id,
        email,
        actor_user_id,
        ip_address,
        user_agent,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    `,
    randomUUID(),
    input.action,
    input.bootstrapMode,
    input.userId,
    input.email,
    input.actorUserId || null,
    input.ipAddress || null,
    input.userAgent || null,
    JSON.stringify(input.metadata || {})
  )
}
