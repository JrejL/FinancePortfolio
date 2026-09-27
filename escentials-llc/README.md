# Escentials LLC · FY2025 financial statements and FP&A pack

> **Illustrative figures, for privacy.** Modeled on the business's size, sales channels and products; not its
> actual results.

Escentials LLC sells designer fragrance on eBay and Shopify, plus its own Car Perfume line. This folder holds a
complete year of reporting for it, from the raw transactions to the business review deck.

| Folder | What is in it |
|---|---|
| [1_Financial_Statements](1_Financial_Statements/) | Income statement, balance sheet, cash flow statement, statement of members' equity and the notes, each as a PDF and an editable Excel file |
| [2_FPA_Analysis](2_FPA_Analysis/) | Budget vs actual, the FY2026 forecast with three scenarios, the KPI dashboard and the SQL analysis |
| [3_Supporting_Schedules](3_Supporting_Schedules/) | Monthly P&L, balance sheet and cash flow, roll forward schedules, the budget, the assumptions, the SQL data pull and the model checks |
| [4_Full_Excel_Model](4_Full_Excel_Model/) | Everything above in one linked workbook: 18 sheets, 1,974 live formulas, 15 integrity checks |
| [5_SQLite_Database](5_SQLite_Database/) | The transaction database, its schema, the SQL queries and their results |
| [6_CRM_Database](6_CRM_Database/) | Customer database: 2,058 customers, their orders and service interactions, with RFM segmentation, cohort retention and repeat purchase analysis, plus a CRM report in Excel and PDF |
| [7_Tableau](7_Tableau/) | Packaged Tableau workbook with four views and a dashboard, plus its data sources as CSV |
| [8_PowerPoint](8_PowerPoint/) | FY2025 business review: 10 slides with native, editable charts, plus a PDF |

## How the files relate

Each Excel file in folders 1 to 3 opens on its own and stays editable: the line items are values and every total
is a live formula. The full model in folder 4 links all of it, so a change on the Assumptions sheet flows through
every statement, and the scenario switch reruns the forecast.

Color code in the Excel files: blue is an input or data pulled with SQL, black is a formula, green links to
another sheet.

## Checks

The Checks sheet in the full model proves the pack ties: the balance sheet balances at every month end, the cash
flow statement agrees with the balance sheet, net income agrees across the statements, and sales agree with
control totals pulled straight from SQL. All 15 checks pass.
