import { describe, it, expect } from 'vitest'
import {
  customerDisplayName,
  customerPickerLabel,
  vehiclePickerLabel
} from './picker-labels'

/**
 * Unit tests for the shared picker-label builders — they must mirror
 * the label formats produced by `pickCustomersRemote`,
 * `pickVehiclesRemote` and `pickCustomerVehiclesRemote`.
 *
 * @group unit
 * @module picker-labels
 */

describe('customerDisplayName', () => {
  it('prefers the company name', () => {
    expect(
      customerDisplayName({
        company: 'Alpha GmbH',
        firstName: 'Max',
        lastName: 'Mustermann',
        customerNumber: 'K-1'
      })
    ).toBe('Alpha GmbH')
  })

  it('falls back to "first last" when no company is set', () => {
    expect(
      customerDisplayName({
        company: null,
        firstName: 'Max',
        lastName: 'Mustermann',
        customerNumber: 'K-1'
      })
    ).toBe('Max Mustermann')
  })

  it('trims a name with only one part', () => {
    expect(
      customerDisplayName({ lastName: 'Mustermann', customerNumber: 'K-1' })
    ).toBe('Mustermann')
    expect(customerDisplayName({ firstName: 'Max' })).toBe('Max')
  })

  it('falls back to the customer number and finally null', () => {
    expect(customerDisplayName({ customerNumber: 'K-42' })).toBe('K-42')
    expect(customerDisplayName({})).toBeNull()
  })
})

describe('customerPickerLabel', () => {
  it('appends the city with a middle dot when set', () => {
    expect(customerPickerLabel({ company: 'Alpha GmbH', city: 'Berlin' })).toBe(
      'Alpha GmbH · Berlin'
    )
  })

  it('omits the city segment when the city is empty', () => {
    expect(
      customerPickerLabel({ firstName: 'Max', lastName: 'Mustermann' })
    ).toBe('Max Mustermann')
    expect(customerPickerLabel({ company: 'Alpha GmbH', city: null })).toBe(
      'Alpha GmbH'
    )
  })

  it('uses the customer number when neither company nor name exist', () => {
    expect(
      customerPickerLabel({ customerNumber: 'K-7', city: 'Hamburg' })
    ).toBe('K-7 · Hamburg')
  })
})

describe('vehiclePickerLabel', () => {
  it('formats plate and make/model', () => {
    expect(
      vehiclePickerLabel({
        licensePlate: 'B-AA 100',
        make: 'VW',
        model: 'Golf'
      })
    ).toBe('B-AA 100 · VW Golf')
  })

  it('uses a dash for a missing plate and missing make/model', () => {
    expect(vehiclePickerLabel({ make: 'VW', model: 'Golf' })).toBe(
      '- · VW Golf'
    )
    expect(vehiclePickerLabel({ licensePlate: 'B-AA 100' })).toBe(
      'B-AA 100 · -'
    )
    expect(vehiclePickerLabel({})).toBe('- · -')
  })

  it('keeps make-only and model-only variants without extra spaces', () => {
    expect(vehiclePickerLabel({ licensePlate: 'X-Y 1', make: 'Audi' })).toBe(
      'X-Y 1 · Audi'
    )
    expect(vehiclePickerLabel({ licensePlate: 'X-Y 1', model: 'A4' })).toBe(
      'X-Y 1 · A4'
    )
  })

  it('appends the holder as a third segment when given', () => {
    expect(
      vehiclePickerLabel(
        { licensePlate: 'B-AA 100', make: 'VW', model: 'Golf' },
        'Alpha GmbH'
      )
    ).toBe('B-AA 100 · VW Golf · Alpha GmbH')
    expect(
      vehiclePickerLabel(
        { licensePlate: 'B-AA 100', make: 'VW', model: 'Golf' },
        null
      )
    ).toBe('B-AA 100 · VW Golf')
  })
})
