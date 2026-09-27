-- Where the money goes after the product itself: every operating cost, from order level fees and the ledger.
WITH year_orders AS (
    SELECT * FROM orders WHERE substr(order_date, 1, 4) = :year
),
year_ledger AS (
    SELECT * FROM expenses WHERE substr(expense_date, 1, 4) = :year
),
costs (category, amount) AS (
    SELECT 'Marketplace fees', SUM(marketplace_fee) FROM year_orders
    UNION ALL
    SELECT 'Payment processing', SUM(payment_fee) FROM year_orders
    UNION ALL
    SELECT 'Shipping and fulfillment', SUM(fulfillment_cost) FROM year_orders
    UNION ALL
    SELECT 'Advertising and marketing',
           (SELECT SUM(ad_fee) FROM year_orders)
           + (SELECT COALESCE(SUM(amount), 0) FROM year_ledger WHERE category = 'Advertising')
    UNION ALL
    SELECT 'Packaging and supplies', SUM(packaging_cost) FROM year_orders
    UNION ALL
    SELECT category, SUM(amount) FROM year_ledger WHERE category <> 'Advertising' GROUP BY category
)
SELECT category,
       ROUND(amount, 2)                         AS amount,
       ROUND(amount / SUM(amount) OVER (), 4)   AS share
FROM costs
ORDER BY amount DESC;
