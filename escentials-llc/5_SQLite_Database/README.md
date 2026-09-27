# SQLite database

`escentials.db` holds the year's transactions: products, customers, orders, order lines, refunds, expenses,
inventory and equipment purchases, owner transactions, sales tax remittances and opening balances. `schema.sql`
defines it.

`queries/` holds the SQL. `monthly_summary.sql` feeds the Excel model's Data sheet; the others (revenue by channel,
margin by product line, top products, expense mix) feed the SQL Analysis sheet and use window functions for
shares and rankings. `results/` holds each query's output as CSV.

Illustrative figures, for privacy: modeled on the business, not its actual results.
