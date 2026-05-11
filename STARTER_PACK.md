# Codex Starter Pack

This repository starter pack defines baseline implementation guardrails for Codex-driven development.

## Files
- `/Users/teerin/Documents/MyDev/Nuxt4/IOT-LINE-Merchant/AGENTS.md`
- `/Users/teerin/Documents/MyDev/Nuxt4/IOT-LINE-Merchant/UI_RULES.md`
- `/Users/teerin/Documents/MyDev/Nuxt4/IOT-LINE-Merchant/API_RULES.md`
- `/Users/teerin/Documents/MyDev/Nuxt4/IOT-LINE-Merchant/DATA_RULES.md`
- `/Users/teerin/Documents/MyDev/Nuxt4/IOT-LINE-Merchant/RBAC.md`

## Guard Script
Run before commit:

```bash
bun run guard:standards
```

Current checks:
- no `pageSize=300`
- no font sizes smaller than `text-sm`
- detect risky dark input background usage without readable text class
- flag weak `orderCode` validation usage

## Recommended Team Workflow
1. Update rules first (`AGENTS.md` + rule docs)
2. Implement with shared components/helpers
3. Run `bun run guard:standards`
4. Commit only when guard passes
