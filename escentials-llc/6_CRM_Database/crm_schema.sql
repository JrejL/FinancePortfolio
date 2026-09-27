-- Escentials LLC CRM database (escentials_crm.db), built from the transaction database attached as `src`.
-- One row per customer, one per order, every service interaction, and views that summarize, score and
-- segment customers. Illustrative figures, for privacy: modeled on the business, not its actual results.
-- Customers are identified by ID only; no names or contact details are stored.

CREATE TABLE metadata AS SELECT * FROM src.metadata;

CREATE TABLE customers AS
SELECT customer_id, first_order_date, acquisition_channel, state, email_opt_in
FROM src.customers;

CREATE TABLE orders AS
SELECT o.order_id,
       o.customer_id,
       o.order_date,
       o.channel,
       ROUND(SUM(l.qty * l.unit_price), 2)                                       AS merchandise,
       ROUND(SUM(l.qty * (l.unit_price - l.unit_cost)), 2)                       AS gross_profit,
       SUM(l.qty)                                                                AS units,
       MAX(CASE WHEN p.product_line = 'Designer fragrance' THEN 1 ELSE 0 END)    AS has_designer,
       MAX(CASE WHEN p.product_line <> 'Designer fragrance' THEN 1 ELSE 0 END)   AS has_car_perfume
FROM src.orders o
JOIN src.order_lines l ON l.order_id = o.order_id
JOIN src.products p    ON p.sku = l.sku
GROUP BY o.order_id, o.customer_id, o.order_date, o.channel;

CREATE TABLE interactions AS SELECT * FROM src.interactions;

CREATE INDEX idx_crm_orders_customer ON orders (customer_id);
CREATE INDEX idx_crm_interactions_customer ON interactions (customer_id);

-- Lifetime view of each customer.
CREATE VIEW customer_summary AS
SELECT c.customer_id,
       c.acquisition_channel,
       c.state,
       c.email_opt_in,
       MIN(o.order_date)                          AS first_order,
       MAX(o.order_date)                          AS last_order,
       COUNT(*)                                   AS orders,
       ROUND(SUM(o.merchandise), 2)               AS lifetime_value,
       ROUND(SUM(o.merchandise) / COUNT(*), 2)    AS avg_order_value,
       ROUND(SUM(o.gross_profit), 2)              AS lifetime_gross_profit
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.acquisition_channel, c.state, c.email_opt_in;

-- Recency, frequency and monetary scores, 1 (low) to 5 (high), as of the fiscal year end.
CREATE VIEW rfm_scores AS
WITH base AS (
    SELECT customer_id,
           CAST(julianday('2025-12-31') - julianday(last_order) AS INTEGER) AS recency_days,
           orders          AS frequency,
           lifetime_value  AS monetary
    FROM customer_summary
)
SELECT customer_id, recency_days, frequency, monetary,
       6 - NTILE(5) OVER (ORDER BY recency_days)                                          AS r_score,
       CASE WHEN frequency >= 4 THEN 5 WHEN frequency = 3 THEN 4 WHEN frequency = 2 THEN 3 ELSE 1 END AS f_score,
       NTILE(5) OVER (ORDER BY monetary)                                                  AS m_score
FROM base;

-- Segments from the scores: who to reward, who to win back.
CREATE VIEW customer_segments AS
SELECT customer_id, recency_days, frequency, monetary, r_score, f_score, m_score,
       CASE WHEN r_score >= 4 AND f_score >= 3 THEN 'Champions'
            WHEN f_score >= 3                  THEN 'At risk'
            WHEN r_score >= 4                  THEN 'New'
            WHEN r_score = 3                   THEN 'Needs attention'
            ELSE 'Hibernating' END AS segment
FROM rfm_scores;
