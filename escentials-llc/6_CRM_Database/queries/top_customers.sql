-- The 25 most valuable customers by lifetime merchandise value, with their segment.
SELECT s.customer_id,
       s.acquisition_channel,
       s.state,
       s.first_order,
       s.last_order,
       s.orders,
       s.lifetime_value,
       s.avg_order_value,
       g.segment
FROM customer_summary s
JOIN customer_segments g ON g.customer_id = s.customer_id
ORDER BY s.lifetime_value DESC
LIMIT 25;
