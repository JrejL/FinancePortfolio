-- Monthly summary that feeds the financial model: one row per month of the fiscal year (:year).
-- Every amount on the workbook's Data sheet comes from this query.
WITH RECURSIVE months (ym, n) AS (
    SELECT printf('%s-%02d', :year, 1), 1
    UNION ALL
    SELECT printf('%s-%02d', :year, n + 1), n + 1 FROM months WHERE n < 12
),
line_detail AS (
    SELECT substr(o.order_date, 1, 7) AS ym, o.channel, p.product_line,
           l.qty, l.qty * l.unit_price AS sales, l.qty * l.unit_cost AS cost
    FROM orders o
    JOIN order_lines l ON l.order_id = o.order_id
    JOIN products p ON p.sku = l.sku
),
sales AS (
    SELECT ym,
           SUM(CASE WHEN channel = 'eBay' THEN sales END)                         AS gross_sales_ebay,
           SUM(CASE WHEN channel = 'Shopify' THEN sales END)                      AS gross_sales_shopify,
           SUM(CASE WHEN product_line = 'Designer fragrance' THEN sales END)      AS sales_designer,
           SUM(CASE WHEN product_line = 'Car Perfume' THEN sales END)             AS sales_car_perfume,
           SUM(CASE WHEN product_line = 'Refills' THEN sales END)                 AS sales_refills,
           SUM(CASE WHEN product_line = 'Designer fragrance' THEN cost END)       AS cost_designer,
           SUM(CASE WHEN product_line <> 'Designer fragrance' THEN cost END)      AS cost_own,
           SUM(qty)                                                               AS units
    FROM line_detail
    GROUP BY ym
),
order_totals AS (
    SELECT substr(order_date, 1, 7) AS ym,
           COUNT(*)                   AS orders,
           SUM(channel = 'eBay')      AS orders_ebay,
           SUM(channel = 'Shopify')   AS orders_shopify,
           SUM(shipping_charged)      AS shipping_income,
           SUM(discount)              AS discounts,
           SUM(tax_collected)         AS sales_tax_collected,
           SUM(marketplace_fee)       AS marketplace_fees,
           SUM(payment_fee)           AS payment_fees,
           SUM(ad_fee)                AS promoted_listing_fees,
           SUM(fulfillment_cost)      AS fulfillment_costs,
           SUM(packaging_cost)        AS packaging_costs
    FROM orders
    GROUP BY ym
),
returned AS (
    SELECT substr(r.refund_date, 1, 7) AS ym,
           COUNT(DISTINCT r.order_id)                                                AS returned_orders,
           SUM(r.merchandise_refund)                                                 AS returns,
           SUM(CASE WHEN p.product_line = 'Designer fragrance' THEN r.cost_returned END)  AS cost_back_designer,
           SUM(CASE WHEN p.product_line <> 'Designer fragrance' THEN r.cost_returned END) AS cost_back_own
    FROM refunds r
    JOIN products p ON p.sku = r.sku
    GROUP BY ym
),
ledger AS (
    SELECT substr(expense_date, 1, 7) AS ym,
           SUM(CASE WHEN category = 'Advertising' THEN amount END)                AS ads,
           SUM(CASE WHEN category = 'Software and subscriptions' THEN amount END) AS software,
           SUM(CASE WHEN category = 'Professional fees' THEN amount END)          AS professional_fees,
           SUM(CASE WHEN category = 'Taxes and licenses' THEN amount END)         AS taxes_licenses,
           SUM(CASE WHEN category = 'General and administrative' THEN amount END) AS general_admin
    FROM expenses
    GROUP BY ym
),
stock AS (
    SELECT substr(purchase_date, 1, 7) AS ym, SUM(amount) AS inventory_purchases
    FROM inventory_purchases GROUP BY ym
),
equipment AS (
    SELECT substr(purchase_date, 1, 7) AS ym, SUM(amount) AS equipment_purchases
    FROM fixed_asset_purchases GROUP BY ym
),
owner AS (
    SELECT substr(txn_date, 1, 7) AS ym,
           SUM(CASE WHEN txn_type = 'contribution' THEN amount END) AS member_contributions,
           SUM(CASE WHEN txn_type = 'distribution' THEN amount END) AS member_distributions
    FROM owner_transactions GROUP BY ym
),
remitted AS (
    SELECT substr(paid_date, 1, 7) AS ym, SUM(amount) AS sales_tax_remitted
    FROM sales_tax_remittances GROUP BY ym
)
SELECT m.ym AS month,
       ROUND(COALESCE(s.gross_sales_ebay, 0), 2)                                AS gross_sales_ebay,
       ROUND(COALESCE(s.gross_sales_shopify, 0), 2)                             AS gross_sales_shopify,
       ROUND(COALESCE(s.sales_designer, 0), 2)                                  AS sales_designer,
       ROUND(COALESCE(s.sales_car_perfume, 0), 2)                               AS sales_car_perfume,
       ROUND(COALESCE(s.sales_refills, 0), 2)                                   AS sales_refills,
       ROUND(COALESCE(o.shipping_income, 0), 2)                                 AS shipping_income,
       ROUND(COALESCE(o.discounts, 0), 2)                                       AS discounts,
       ROUND(COALESCE(r.returns, 0), 2)                                         AS returns,
       ROUND(COALESCE(s.cost_designer, 0) - COALESCE(r.cost_back_designer, 0), 2) AS cogs_designer,
       ROUND(COALESCE(s.cost_own, 0) - COALESCE(r.cost_back_own, 0), 2)           AS cogs_own,
       ROUND(COALESCE(o.marketplace_fees, 0), 2)                                AS marketplace_fees,
       ROUND(COALESCE(o.payment_fees, 0), 2)                                    AS payment_fees,
       ROUND(COALESCE(o.fulfillment_costs, 0), 2)                               AS fulfillment_costs,
       ROUND(COALESCE(o.promoted_listing_fees, 0) + COALESCE(e.ads, 0), 2)      AS advertising,
       ROUND(COALESCE(o.packaging_costs, 0), 2)                                 AS packaging_costs,
       ROUND(COALESCE(e.software, 0), 2)                                        AS software,
       ROUND(COALESCE(e.professional_fees, 0), 2)                               AS professional_fees,
       ROUND(COALESCE(e.taxes_licenses, 0), 2)                                  AS taxes_licenses,
       ROUND(COALESCE(e.general_admin, 0), 2)                                   AS general_admin,
       ROUND(COALESCE(i.inventory_purchases, 0), 2)                             AS inventory_purchases,
       ROUND(COALESCE(f.equipment_purchases, 0), 2)                             AS equipment_purchases,
       ROUND(COALESCE(w.member_contributions, 0), 2)                            AS member_contributions,
       ROUND(COALESCE(w.member_distributions, 0), 2)                            AS member_distributions,
       ROUND(COALESCE(o.sales_tax_collected, 0), 2)                             AS sales_tax_collected,
       ROUND(COALESCE(t.sales_tax_remitted, 0), 2)                              AS sales_tax_remitted,
       COALESCE(o.orders, 0)                                                    AS orders,
       COALESCE(o.orders_ebay, 0)                                               AS orders_ebay,
       COALESCE(o.orders_shopify, 0)                                            AS orders_shopify,
       COALESCE(s.units, 0)                                                     AS units,
       COALESCE(r.returned_orders, 0)                                           AS returned_orders
FROM months m
LEFT JOIN sales s        ON s.ym = m.ym
LEFT JOIN order_totals o ON o.ym = m.ym
LEFT JOIN returned r     ON r.ym = m.ym
LEFT JOIN ledger e       ON e.ym = m.ym
LEFT JOIN stock i        ON i.ym = m.ym
LEFT JOIN equipment f    ON f.ym = m.ym
LEFT JOIN owner w        ON w.ym = m.ym
LEFT JOIN remitted t     ON t.ym = m.ym
ORDER BY m.ym;
