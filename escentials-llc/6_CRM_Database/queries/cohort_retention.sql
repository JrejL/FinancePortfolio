-- Monthly cohorts: customers grouped by the month of their first order, and the share who ordered again
-- one, two and three months later. Months not yet observed are left blank rather than shown as zero.
WITH firsts AS (
    SELECT customer_id, substr(MIN(order_date), 1, 7) AS cohort
    FROM orders
    GROUP BY customer_id
),
activity AS (
    SELECT DISTINCT o.customer_id, f.cohort,
           (CAST(substr(o.order_date, 1, 4) AS INTEGER) * 12 + CAST(substr(o.order_date, 6, 2) AS INTEGER))
         - (CAST(substr(f.cohort, 1, 4) AS INTEGER) * 12 + CAST(substr(f.cohort, 6, 2) AS INTEGER)) AS months_later
    FROM orders o
    JOIN firsts f ON f.customer_id = o.customer_id
),
last_seen AS (
    SELECT CAST(substr(MAX(order_date), 1, 4) AS INTEGER) * 12 + CAST(substr(MAX(order_date), 6, 2) AS INTEGER) AS last_month
    FROM orders
),
cohorts AS (
    SELECT cohort,
           CAST(substr(cohort, 1, 4) AS INTEGER) * 12 + CAST(substr(cohort, 6, 2) AS INTEGER) AS cohort_month,
           COUNT(DISTINCT CASE WHEN months_later = 0 THEN customer_id END) AS new_customers,
           COUNT(DISTINCT CASE WHEN months_later = 1 THEN customer_id END) AS m1,
           COUNT(DISTINCT CASE WHEN months_later = 2 THEN customer_id END) AS m2,
           COUNT(DISTINCT CASE WHEN months_later = 3 THEN customer_id END) AS m3
    FROM activity
    GROUP BY cohort
)
SELECT cohort,
       new_customers,
       CASE WHEN cohort_month + 1 <= last_month THEN ROUND(1.0 * m1 / new_customers, 4) END AS back_month_1,
       CASE WHEN cohort_month + 2 <= last_month THEN ROUND(1.0 * m2 / new_customers, 4) END AS back_month_2,
       CASE WHEN cohort_month + 3 <= last_month THEN ROUND(1.0 * m3 / new_customers, 4) END AS back_month_3
FROM cohorts, last_seen
ORDER BY cohort;
