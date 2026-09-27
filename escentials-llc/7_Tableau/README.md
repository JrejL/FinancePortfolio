# Tableau

`Escentials_FY2025_Dashboards.twbx` is a packaged workbook that carries its own data as Tableau extracts (.hyper),
so it opens in Tableau Desktop or the free Tableau Public with nothing else to install. It holds four views (net
revenue by month, net income by month, sales by channel, and gross margin by product line) and an overview
dashboard.

`data/` holds the sources as CSV, for connecting fresh:

- `sales_lines.csv`: one row per order line, with channel, state, product line, sales, cost and gross profit
- `monthly_financials.csv`: monthly net revenue, costs, net income, spending and budget, read from the Excel
  model so the dashboards match the statements
- `customers.csv`: one row per customer from the CRM database, with lifetime value and RFM segment

Illustrative figures, for privacy: modeled on the business, not its actual results.
