import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id?: string
      role?: 'ADMIN' | 'USER' | 'OWNER' | 'MANAGER' | 'STAFF'
      tenantId?: string | null
      merchantAccountId?: string | null
      provider?: string
    }
  }
}
