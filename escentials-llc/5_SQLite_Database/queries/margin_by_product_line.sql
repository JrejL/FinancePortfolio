-- Gross margin by product line, before returns: the own brand line is small in sales but rich in margin.
SELECT p.product_line,
       SUM(l.qty)                                                          AS units,
       ROUND(SUM(l.qty * l.unit_price), 2)                                 AS merchandise_sales,
       ROUND(SUM(l.qty * l.unit_cost), 2)                                  AS cost_of_goods,
       ROUND(SUM(l.qty * (l.unit_price - l.unit_cost)), 2)                 AS gross_profit,
       ROUND(SUM(l.qty * (l.unit_price - l.unit_cost)) / SUM(l.qty * l.unit_price), 4) AS gross_margin,
       ROUND(SUM(l.qty * (l.unit_price - l.unit_cost))
             / SUM(SUM(l.qty * (l.unit_price - l.unit_cost))) OVER (), 4)  AS share_of_gross_profit
FROM order_lines l
JOIN orders o   ON o.order_id = l.order_id
JOIN products p ON p.sku = l.sku
WHERE substr(o.order_date, 1, 4) = :year
GROUP BY p.product_line
ORDER BY gross_profit DESC;
