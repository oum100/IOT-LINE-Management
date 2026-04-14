import type { MachineWithPrices } from '~~/shared/types'

const washerPrices = [
  { suffix: 'p1', label: 'Cold', amount: 1, durationMinutes: 30 },
  { suffix: 'p2', label: 'Warm', amount: 2, durationMinutes: 60 },
  { suffix: 'p3', label: 'Hot', amount: 3, durationMinutes: 90 }
]

const dryerPrices = [
  { suffix: 'p1', label: 'Cold', amount: 35, durationMinutes: 60 },
  { suffix: 'p2', label: 'Warm', amount: 50, durationMinutes: 75 },
  { suffix: 'p3', label: 'Hot', amount: 65, durationMinutes: 90 }
]

const baseMachines: Array<Omit<MachineWithPrices, 'prices'>> = [
  { id: 'demo-w01', code: 'W01', name: 'Washer 01', kind: 'WASHER', status: 'AVAILABLE', locationLabel: 'โซนซัก A1' },
  { id: 'demo-w02', code: 'W02', name: 'Washer 02', kind: 'WASHER', status: 'AVAILABLE', locationLabel: 'โซนซัก A2' },
  { id: 'demo-w03', code: 'W03', name: 'Washer 03', kind: 'WASHER', status: 'AVAILABLE', locationLabel: 'โซนซัก A3' },
  { id: 'demo-w04', code: 'W04', name: 'Washer 04', kind: 'WASHER', status: 'AVAILABLE', locationLabel: 'โซนซัก B1' },
  { id: 'demo-w05', code: 'W05', name: 'Washer 05', kind: 'WASHER', status: 'AVAILABLE', locationLabel: 'โซนซัก B2' },
  { id: 'demo-w06', code: 'W06', name: 'Washer 06', kind: 'WASHER', status: 'AVAILABLE', locationLabel: 'โซนซัก B3' },
  { id: 'demo-d01', code: 'D01', name: 'Dryer 01', kind: 'DRYER', status: 'AVAILABLE', locationLabel: 'โซนอบ A1' },
  { id: 'demo-d02', code: 'D02', name: 'Dryer 02', kind: 'DRYER', status: 'AVAILABLE', locationLabel: 'โซนอบ A2' },
  { id: 'demo-d03', code: 'D03', name: 'Dryer 03', kind: 'DRYER', status: 'AVAILABLE', locationLabel: 'โซนอบ A3' },
  { id: 'demo-d04', code: 'D04', name: 'Dryer 04', kind: 'DRYER', status: 'AVAILABLE', locationLabel: 'โซนอบ B1' },
  { id: 'demo-d05', code: 'D05', name: 'Dryer 05', kind: 'DRYER', status: 'AVAILABLE', locationLabel: 'โซนอบ B2' },
  { id: 'demo-d06', code: 'D06', name: 'Dryer 06', kind: 'DRYER', status: 'AVAILABLE', locationLabel: 'โซนอบ B3' }
]

export const demoMachines: MachineWithPrices[] = baseMachines.map((machine) => ({
  ...machine,
  prices: (machine.kind === 'WASHER' ? washerPrices : dryerPrices).map(price => ({
    id: `${machine.id}-${price.suffix}`,
    label: price.label,
    amount: price.amount,
    durationMinutes: price.durationMinutes
  }))
}))
