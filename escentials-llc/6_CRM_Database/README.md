# CRM database

**Start here:** `Escentials_CRM_Report.pdf`, or `Escentials_CRM_Report.xlsx` for the same report plus the full
customer list with filters. No database software needed: key figures, RFM segments, repeat purchase, the top 25
customers, monthly cohort retention and customer service.

`escentials_crm.db` (SQLite) is built from the transaction database by `crm_schema.sql`.

**Tables:** `customers` (acquisition channel, state, email opt in; IDs only, no names or contact details),
`orders` (one row per order, with its value and gross profit) and `interactions` (service touchpoints: returns,
shipping questions, scent questions, order changes).

**Views:** `customer_summary` (lifetime value per customer), `rfm_scores` (recency, frequency and monetary scores
from 1 to 5, using NTILE) and `customer_segments` (Champions, At risk, New, Needs attention, Hibernating).

`queries/` holds the analysis and `results/` its output as CSV: RFM segments, the top 25 customers, repeat purchase
by acquisition channel, monthly cohort retention and service interactions by topic.

Illustrative figures, for privacy: modeled on the business, not its actual results.
