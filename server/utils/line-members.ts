import { prisma } from './prisma'

type UpsertLineMemberInput = {
  lineUserId: string
  tenantId: string
  merchantAccountId?: string | null
  branchId: string
  displayName?: string | null
  pictureUrl?: string | null
  liffId?: string | null
}

let tableEnsured = false

async function ensureLineMembersTable() {
  if (tableEnsured) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS line_members (
      id TEXT PRIMARY KEY,
      line_user_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      merchant_account_id TEXT NULL,
      branch_id TEXT NOT NULL,
      display_name TEXT NULL,
      picture_url TEXT NULL,
      liff_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (line_user_id, branch_id)
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_line_members_branch ON line_members(branch_id)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_line_members_tenant ON line_members(tenant_id)`)
  tableEnsured = true
}

export async function upsertLineMember(input: UpsertLineMemberInput) {
  await ensureLineMembersTable()
  const id = `lm_${input.branchId}_${input.lineUserId}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 120)
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO line_members (
        id, line_user_id, tenant_id, merchant_account_id, branch_id, display_name, picture_url, liff_id, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), now())
      ON CONFLICT (line_user_id, branch_id)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        merchant_account_id = EXCLUDED.merchant_account_id,
        display_name = COALESCE(EXCLUDED.display_name, line_members.display_name),
        picture_url = COALESCE(EXCLUDED.picture_url, line_members.picture_url),
        liff_id = COALESCE(EXCLUDED.liff_id, line_members.liff_id),
        updated_at = now()
    `,
    id,
    input.lineUserId,
    input.tenantId,
    input.merchantAccountId || null,
    input.branchId,
    input.displayName || null,
    input.pictureUrl || null,
    input.liffId || null
  )
}

