-- Repeat purchase rate by acquisition channel, and what a repeat customer is worth.
SELECT acquisition_channel,
       COUNT(*)                                                    AS customers,
       SUM(orders > 1)                                             AS repeat_customers,
       ROUND(AVG(orders > 1), 4)                                   AS repeat_rate,
       ROUND(AVG(orders), 2)                                       AS orders_per_customer,
       ROUND(AVG(lifetime_value), 2)                               AS avg_lifetime_value,
       ROUND(AVG(CASE WHEN orders > 1 THEN lifetime_value END), 2) AS repeat_customer_value
FROM customer_summary
GROUP BY acquisition_channel
ORDER BY customers DESC;
