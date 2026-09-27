-- Customer service load by topic: volume, days to close, the share that ended in a refund, and where it came in.
SELECT topic,
       COUNT(*)                                               AS interactions,
       ROUND(AVG(julianday(closed) - julianday(opened)), 1)   AS avg_days_to_close,
       ROUND(AVG(outcome = 'Refunded'), 4)                    AS refund_share,
       SUM(channel = 'eBay messages')                         AS via_ebay_messages,
       SUM(channel = 'Email')                                 AS via_email
FROM interactions
GROUP BY topic
ORDER BY interactions DESC;
