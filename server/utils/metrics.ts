import client from 'prom-client'

const register = new client.Registry()
client.collectDefaultMetrics({ register })

export const orderCounter = new client.Counter({
  name: 'laundry_orders_total',
  help: 'Total created laundry orders',
  registers: [register]
})

export const slipUploadCounter = new client.Counter({
  name: 'laundry_slip_upload_total',
  help: 'Total uploaded payment slips',
  registers: [register]
})

export const deviceCommandCounter = new client.Counter({
  name: 'laundry_device_commands_total',
  help: 'Total queued device commands',
  registers: [register]
})

export { register }
