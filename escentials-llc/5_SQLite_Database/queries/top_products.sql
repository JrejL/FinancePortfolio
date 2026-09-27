-- The ten products that earned the most gross profit, ranked, with units, sales and margin.
SELECT p.name                                                                AS product,
       RANK() OVER (ORDER BY SUM(l.qty * (l.unit_price - l.unit_cost)) DESC) AS rank,
       p.product_line,
       SUM(l.qty)                                                            AS units,
       ROUND(SUM(l.qty * l.unit_price), 2)                                   AS merchandise_sales,
       ROUND(SUM(l.qty * (l.unit_price - l.unit_cost)), 2)                   AS gross_profit,
       ROUND(SUM(l.qty * (l.unit_price - l.unit_cost)) / SUM(l.qty * l.unit_price), 4) AS gross_margin
FROM order_lines l
JOIN orders o   ON o.order_id = l.order_id
JOIN products p ON p.sku = l.sku
WHERE substr(o.order_date, 1, 4) = :year
GROUP BY p.sku, p.name, p.product_line
ORDER BY gross_profit DESC
LIMIT 10;
