-- Merchandise sales by channel, with order count, average order value and share of the total.
SELECT o.channel,
       COUNT(DISTINCT o.order_id)                                                   AS orders,
       ROUND(SUM(l.qty * l.unit_price), 2)                                          AS merchandise_sales,
       ROUND(SUM(l.qty * l.unit_price) / COUNT(DISTINCT o.order_id), 2)             AS avg_order_value,
       ROUND(SUM(l.qty * l.unit_price) / SUM(SUM(l.qty * l.unit_price)) OVER (), 4) AS share_of_sales
FROM orders o
JOIN order_lines l ON l.order_id = o.order_id
WHERE substr(o.order_date, 1, 4) = :year
GROUP BY o.channel
ORDER BY merchandise_sales DESC;
