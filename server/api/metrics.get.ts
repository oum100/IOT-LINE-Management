import { register } from '../utils/metrics'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', register.contentType)
  return register.metrics()
})
