// Picks the driver for this run: SUITE_DRIVER=guren|void, SUITE_BASE_URL=http://127.0.0.1:<port>
import type { Driver } from './types.ts'
import { GurenDriver } from './guren.ts'

export function loadDriver(): Driver {
  const name = process.env.SUITE_DRIVER ?? 'guren'
  const baseUrl = process.env.SUITE_BASE_URL
  if (!baseUrl) throw new Error('SUITE_BASE_URL is not set (e.g. http://127.0.0.1:4100)')
  switch (name) {
    case 'guren':
      return new GurenDriver(baseUrl)
    case 'void': {
      // Written separately against ./types.ts. Expected export:
      //   export class VoidDriver implements Driver { constructor(baseUrl: string) }
      const { VoidDriver } = require('./void.ts') as { VoidDriver: new (baseUrl: string) => Driver }
      return new VoidDriver(baseUrl)
    }
    default:
      throw new Error(`unknown SUITE_DRIVER: ${name}`)
  }
}
