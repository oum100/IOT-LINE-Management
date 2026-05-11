import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const EXCLUDE = new Set(['node_modules', '.nuxt', '.git', 'dist', '.output'])
const TARGET_EXT = new Set(['.vue', '.ts', '.js', '.mjs'])
const STRICT_UI = process.env.STRICT_UI === '1'

const issues = []
const warnings = []

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.has(name)) continue
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, files)
      continue
    }
    const ext = path.extname(full)
    if (TARGET_EXT.has(ext)) files.push(full)
  }
  return files
}

function pushIssue(file, message) {
  issues.push(`${path.relative(ROOT, file)}: ${message}`)
}

function pushWarning(file, message) {
  warnings.push(`${path.relative(ROOT, file)}: ${message}`)
}

function checkFile(file) {
  const content = readFileSync(file, 'utf8')
  const relative = path.relative(ROOT, file)
  const isServerApi = (relative.startsWith('server/api/admin/') || relative.startsWith('server/api/app/'))
  const isPortalPage = relative.startsWith('app/pages/app/') && relative.endsWith('.vue')
  const isUiSurface =
    relative.startsWith('app/pages/admin/')
    || relative.startsWith('app/pages/app/')
    || relative.startsWith('app/components/admin/')
    || relative.startsWith('app/components/asset/')
    || relative.startsWith('app/components/promotion/')

  const pageSizeMatches = content.matchAll(/pageSize\s*[:=]\s*(\d{1,4})/g)
  for (const m of pageSizeMatches) {
    const n = Number(m[1] || '0')
    if (Number.isFinite(n) && n > 200) {
      pushIssue(file, `Found pageSize=${n} (must be <= 200).`)
    }
  }

  if (content.includes('orderCode') && content.match(/[a-z]/) && content.includes('[A-Z0-9') === false) {
    pushIssue(file, 'orderCode appears without explicit uppercase-safe validation pattern.')
  }

  if (isServerApi) {
    const hasGuard = /assertPermission\(|assertAnyPermission\(|assertAdminAccess\(/.test(content)
    if (!hasGuard) {
      pushIssue(file, 'Missing API permission/admin guard (assertPermission/assertAnyPermission/assertAdminAccess).')
    }
  }

  if (isPortalPage && content.includes('/api/admin/')) {
    pushIssue(file, 'Portal app page must not call /api/admin/* directly.')
  }

  if (isUiSurface) {
    if (content.includes('text-[10px]') || content.includes('text-[11px]')) {
      const msg = 'Found text smaller than text-sm (text-[10px]/text-[11px]).'
      if (STRICT_UI) pushIssue(file, msg)
      else pushWarning(file, msg)
    }

    const smallLabel = /<label[^>]*class=["'][^"']*\btext-xs\b[^"']*["']/m.test(content)
    if (smallLabel) {
      const msg = 'Found label using text-xs; labels must be text-sm+.'
      if (STRICT_UI) pushIssue(file, msg)
      else pushWarning(file, msg)
    }

    const hasRiskyDarkInput = content.includes('dark:bg-slate-800') && !content.includes('dark:text-slate-100')
    if (hasRiskyDarkInput) {
      const msg = 'Possible dark input contrast risk (dark:bg-slate-800 without dark:text-slate-100).'
      if (STRICT_UI) pushIssue(file, msg)
      else pushWarning(file, msg)
    }
  }
}

const files = walk(ROOT)
for (const file of files) checkFile(file)

if (issues.length) {
  console.error('Guard checks failed:')
  for (const i of issues) console.error(`- ${i}`)
  if (warnings.length) {
    console.warn('\nWarnings:')
    for (const w of warnings) console.warn(`- ${w}`)
  }
  process.exit(1)
}

if (warnings.length) {
  console.warn('Guard checks passed with warnings:')
  for (const w of warnings) console.warn(`- ${w}`)
  process.exit(0)
}

console.log('Guard checks passed.')
