import { Queue } from 'bullmq'
import Redis from 'ioredis'

let connection: Redis | null = null

function getConnection(url: string) {
  if (!connection) {
    connection = new Redis(url, {
      maxRetriesPerRequest: null
    })
  }

  return connection
}

export function getLaundryQueue(redisUrl: string) {
  return new Queue('laundry-device-commands', {
    connection: getConnection(redisUrl)
  })
}
