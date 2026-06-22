import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  countCustomers,
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  listCustomersForBroadcast,
  nextCustomerNumber,
  updateCustomer
} from './customer-service'
import { db } from '$lib/server/db/client'
import { customers, numberRanges } from '$lib/server/db/schema'

/**
 * Integration tests for the customer service, exercising the full
 * Drizzle query layer against an in-memory pg-mem database.
 *
 * @group integration
 * @module customer-service
 */
describe('customer-service', () => {
  beforeEach(async () => {
    await db.delete(customers)
    await db.delete(numberRanges)
  })

  describe('createCustomer', () => {
    it('persists a customer and returns the created row', async () => {
      const created = await createCustomer({
        customerNumber: 'KU-00001',
        firstName: 'Max',
        lastName: 'Mustermann',
        city: 'Berlin',
        email: 'max@example.de'
      })
      expect(created.id).toBeTruthy()
      expect(created.customerNumber).toBe('KU-00001')
      expect(created.lastName).toBe('Mustermann')
      const fetched = await getCustomer(created.id)
      expect(fetched?.lastName).toBe('Mustermann')
    })

    it('auto-assigns the next customer number when none is given', async () => {
      await db
        .insert(numberRanges)
        .values({
          kind: 'customer',
          formatTemplate: 'KU-{NNNNN}',
          nextValue: 42
        })
      const created = await createCustomer({
        customerNumber: undefined,
        firstName: 'Erika',
        lastName: 'Beispiel'
      })
      expect(created.customerNumber).toBe('KU-00042')
    })

    it('persists an eBay customer with only the handle + kind', async () => {
      const created = await createCustomer({
        customerNumber: 'KU-EBAY01',
        kind: 'ebay',
        ebayHandle: 'midnight-bidder'
      })
      expect(created.kind).toBe('ebay')
      expect(created.ebayHandle).toBe('midnight-bidder')
      expect(created.firstName).toBeNull()
      expect(created.lastName).toBeNull()
      expect(created.wantsBroadcast).toBe(false)
    })

    it('persists the wantsBroadcast opt-in flag', async () => {
      const created = await createCustomer({
        customerNumber: 'KU-NL001',
        firstName: 'News',
        lastName: 'Letter',
        wantsBroadcast: true
      })
      expect(created.wantsBroadcast).toBe(true)
    })
  })

  describe('nextCustomerNumber', () => {
    it('falls back to the default template if no range exists', async () => {
      const num = await nextCustomerNumber()
      expect(num).toBe('KU-00001')
    })

    it('renders the configured template and bumps nextValue', async () => {
      await db
        .insert(numberRanges)
        .values({ kind: 'customer', formatTemplate: 'C-{NNNN}', nextValue: 7 })
      const first = await nextCustomerNumber()
      const second = await nextCustomerNumber()
      expect(first).toBe('C-0007')
      expect(second).toBe('C-0008')
    })
  })

  describe('listCustomers', () => {
    beforeEach(async () => {
      await db.insert(customers).values([
        {
          customerNumber: 'KU-00001',
          firstName: 'Anna',
          lastName: 'Albers',
          city: 'Berlin',
          email: 'anna@example.de',
          company: null
        },
        {
          customerNumber: 'KU-00002',
          firstName: 'Bert',
          lastName: 'Braun',
          city: 'Hamburg',
          company: 'Braun GmbH',
          zip: '20095'
        },
        {
          customerNumber: 'KU-00003',
          firstName: 'Clara',
          lastName: 'Carstens',
          city: 'München',
          phone: '+49 89 12345',
          company: null
        }
      ])
    })

    it('paginates results and reports total + pageCount', async () => {
      const res = await listCustomers({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(3)
      expect(res.pageCount).toBe(2)
      expect(res.page).toBe(1)
    })

    it('filters by case-insensitive name search', async () => {
      const res = await listCustomers({ page: 1, size: 25, q: 'braun' })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Braun')
    })

    it('filters by city', async () => {
      const res = await listCustomers({ page: 1, size: 25, q: 'München' })
      expect(res.items.map((c) => c.lastName)).toEqual(['Carstens'])
    })

    it('filters by customer number', async () => {
      const res = await listCustomers({ page: 1, size: 25, q: 'KU-00002' })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Braun')
    })

    it('filters by phone', async () => {
      const res = await listCustomers({ page: 1, size: 25, q: '12345' })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Carstens')
    })

    it('filters by zip', async () => {
      const res = await listCustomers({ page: 1, size: 25, q: '20095' })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Braun')
    })

    it('filters by kind=business (non-null company)', async () => {
      const res = await listCustomers({ page: 1, size: 25, kind: 'business' })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Braun')
    })

    it('filters by kind=private (null company)', async () => {
      const res = await listCustomers({ page: 1, size: 25, kind: 'private' })
      expect(res.total).toBe(2)
      expect(res.items.map((c) => c.lastName).sort()).toEqual([
        'Albers',
        'Carstens'
      ])
    })

    it('filters by kind=ebay (only ebay-kind rows)', async () => {
      await db
        .insert(customers)
        .values({
          customerNumber: 'KU-EB001',
          kind: 'ebay',
          ebayHandle: 'bargain-hunter-99',
          firstName: 'Hugo'
        })
      const res = await listCustomers({ page: 1, size: 25, kind: 'ebay' })
      expect(res.total).toBe(1)
      expect(res.items[0].ebayHandle).toBe('bargain-hunter-99')
      expect(res.items[0].kind).toBe('ebay')
    })

    it('kind=all excludes ebay-kind rows', async () => {
      await db
        .insert(customers)
        .values({
          customerNumber: 'KU-EB002',
          kind: 'ebay',
          ebayHandle: 'speedy-seller'
        })
      const res = await listCustomers({ page: 1, size: 25, kind: 'all' })
      // The three seeded regulars; the freshly-added ebay row stays hidden.
      expect(res.total).toBe(3)
      expect(res.items.every((c) => c.kind === 'regular')).toBe(true)
    })

    it('search matches the ebayHandle column', async () => {
      await db
        .insert(customers)
        .values({
          customerNumber: 'KU-EB003',
          kind: 'ebay',
          ebayHandle: 'foxy-bidder'
        })
      const res = await listCustomers({
        page: 1,
        size: 25,
        q: 'foxy',
        kind: 'ebay'
      })
      expect(res.total).toBe(1)
      expect(res.items[0].ebayHandle).toBe('foxy-bidder')
    })

    it('always hides archived customers', async () => {
      const [first] = await db.select().from(customers).limit(1)
      await updateCustomer(first.id, { archived: true })
      const res = await listCustomers({ page: 1, size: 25 })
      expect(res.total).toBe(2)
      expect(res.items.find((c) => c.id === first.id)).toBeUndefined()
    })

    it('returns pageCount=1 even when empty', async () => {
      await db.delete(customers)
      const res = await listCustomers({ page: 1, size: 25 })
      expect(res.total).toBe(0)
      expect(res.items).toEqual([])
      expect(res.pageCount).toBe(1)
    })

    it('honors the customerNumber ascending sort', async () => {
      const res = await listCustomers({
        page: 1,
        size: 25,
        sort: 'customerNumber'
      })
      expect(res.items.map((c) => c.customerNumber)).toEqual([
        'KU-00001',
        'KU-00002',
        'KU-00003'
      ])
    })

    it('honors the customerNumber descending sort', async () => {
      const res = await listCustomers({
        page: 1,
        size: 25,
        sort: '-customerNumber'
      })
      expect(res.items.map((c) => c.customerNumber)).toEqual([
        'KU-00003',
        'KU-00002',
        'KU-00001'
      ])
    })

    it('honors the lastName ascending sort', async () => {
      const res = await listCustomers({ page: 1, size: 25, sort: 'lastName' })
      expect(res.items.map((c) => c.lastName)).toEqual([
        'Albers',
        'Braun',
        'Carstens'
      ])
    })
  })

  describe('updateCustomer', () => {
    it('updates fields and refreshes updatedAt', async () => {
      const created = await createCustomer({
        customerNumber: 'KU-00010',
        firstName: 'Old',
        lastName: 'Name'
      })
      const updated = await updateCustomer(created.id, { firstName: 'New' })
      expect(updated.firstName).toBe('New')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime()
      )
    })
  })

  describe('deleteCustomer', () => {
    it('removes the row', async () => {
      const created = await createCustomer({
        customerNumber: 'KU-00011',
        firstName: 'Doomed',
        lastName: 'Soul'
      })
      await deleteCustomer(created.id)
      expect(await getCustomer(created.id)).toBeNull()
    })
  })

  describe('getCustomer', () => {
    it('returns null for unknown id', async () => {
      expect(
        await getCustomer('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })
  })

  describe('listCustomersForBroadcast', () => {
    it('returns only non-archived customers with wantsBroadcast=true', async () => {
      await db.insert(customers).values([
        {
          customerNumber: 'KU-NL010',
          firstName: 'Anja',
          lastName: 'Alphabet',
          kind: 'regular',
          wantsBroadcast: true,
          archived: false
        },
        {
          customerNumber: 'KU-NL011',
          firstName: 'Bea',
          lastName: 'Beta',
          kind: 'regular',
          wantsBroadcast: true,
          archived: true
        },
        {
          customerNumber: 'KU-NL012',
          firstName: 'Carl',
          lastName: 'Cee',
          kind: 'regular',
          wantsBroadcast: false,
          archived: false
        },
        {
          customerNumber: 'KU-NL013',
          kind: 'ebay',
          ebayHandle: 'newsletter-ebay',
          wantsBroadcast: true,
          archived: false
        }
      ])
      const rows = await listCustomersForBroadcast()
      // Anja (regular, opted in) + the ebay opt-in — Bea is archived,
      // Carl opted out.
      expect(rows.map((c) => c.customerNumber).sort()).toEqual([
        'KU-NL010',
        'KU-NL013'
      ])
    })

    it('returns an empty array when no one has opted in', async () => {
      const rows = await listCustomersForBroadcast()
      expect(rows).toEqual([])
    })
  })

  describe('countCustomers', () => {
    it('counts only non-archived customers', async () => {
      await db.insert(customers).values([
        {
          customerNumber: 'KU-90001',
          firstName: 'A',
          lastName: 'A',
          archived: false
        },
        {
          customerNumber: 'KU-90002',
          firstName: 'B',
          lastName: 'B',
          archived: true
        }
      ])
      expect(await countCustomers()).toBe(1)
    })

    it('returns 0 when the table is empty', async () => {
      expect(await countCustomers()).toBe(0)
    })
  })
})
