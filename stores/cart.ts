import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import type { MachineWithPrices } from '~~/shared/types'

type CartItem = {
  cartId: string
  machineId: string
  machineName: string
  priceId: string
  priceLabel: string
  durationMinutes: number
  amount: number
}

type MachineSelectionInput = {
  machine: MachineWithPrices
  priceId: string
}

export const useCartStore = defineStore(
  'laundry-cart',
  {
    state: () => ({
      items: [] as CartItem[]
    }),
    getters: {
      totalAmount: state => state.items.reduce((sum, item) => sum + item.amount, 0)
    },
    actions: {
      addSelection(machine: MachineWithPrices, priceId: string) {
        const price = machine.prices.find(entry => entry.id === priceId)

        if (!price) {
          return
        }

        this.items.push({
          cartId: nanoid(),
          machineId: machine.id,
          machineName: machine.name,
          priceId: price.id,
          priceLabel: price.label,
          durationMinutes: price.durationMinutes,
          amount: price.amount
        })
      },
      replaceSelections(selections: MachineSelectionInput[]) {
        this.items = selections.flatMap((selection) => {
          const price = selection.machine.prices.find(entry => entry.id === selection.priceId)

          if (!price) {
            return []
          }

          return [{
            cartId: nanoid(),
            machineId: selection.machine.id,
            machineName: selection.machine.name,
            priceId: price.id,
            priceLabel: price.label,
            durationMinutes: price.durationMinutes,
            amount: price.amount
          }]
        })
      },
      removeSelection(cartId: string) {
        this.items = this.items.filter(item => item.cartId !== cartId)
      },
      clear() {
        this.items = []
      }
    },
    persist: true
  }
)
