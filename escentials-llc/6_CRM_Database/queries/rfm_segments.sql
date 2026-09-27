-- Customers by RFM segment: how many, what they spend, and each segment's share of revenue.
SELECT segment,
       COUNT(*)                                                   AS customers,
       ROUND(1.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 4)           AS share_of_customers,
       ROUND(SUM(monetary), 2)                                    AS revenue,
       ROUND(SUM(monetary) / SUM(SUM(monetary)) OVER (), 4)       AS share_of_revenue,
       ROUND(AVG(monetary), 2)                                    AS revenue_per_customer,
       ROUND(AVG(frequency), 2)                                   AS orders_per_customer
FROM customer_segments
GROUP BY segment
ORDER BY revenue DESC;
