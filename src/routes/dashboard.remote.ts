import { query } from '$app/server'
import { db } from '$lib/server/db/client'
import { customers, vehicles, ledgerEntries } from '$lib/server/db/schema'
import { count, eq, sql } from 'drizzle-orm'

/**
 * Dashboard KPI summary.
 *
 * @group integration
 * @module dashboard
 */
export const getDashboardKpis = query(async () => {
  const [customerCount, vehicleCount, monthlyRow] = await Promise.all([
    db
      .select({ value: count() })
      .from(customers)
      .where(eq(customers.archived, false)),
    db
      .select({ value: count() })
      .from(vehicles)
      .where(eq(vehicles.archived, false)),
    db
      .select({
        income: sql<string>`coalesce(sum(case when ${ledgerEntries.direction} = 'income' then ${ledgerEntries.amountGross} else 0 end), 0)`,
        expense: sql<string>`coalesce(sum(case when ${ledgerEntries.direction} = 'expense' then ${ledgerEntries.amountGross} else 0 end), 0)`
      })
      .from(ledgerEntries)
      .where(
        sql`date_trunc('month', ${ledgerEntries.entryDate}) = date_trunc('month', current_date)`
      )
  ])
  const income = Number(monthlyRow[0]?.income ?? 0)
  const expense = Number(monthlyRow[0]?.expense ?? 0)
  return {
    customers: Number(customerCount[0]?.value ?? 0),
    vehicles: Number(vehicleCount[0]?.value ?? 0),
    monthlyIncome: income,
    monthlyExpense: expense,
    monthlyBalance: income - expense
  }
})
