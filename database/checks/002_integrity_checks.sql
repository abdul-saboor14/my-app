
-- ========================================
-- ROW COUNTS
-- ========================================

SELECT 'users' AS entity, COUNT(*) FROM users
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'dining_tables', COUNT(*) FROM dining_tables
UNION ALL
SELECT 'menu_items', COUNT(*) FROM menu_items
UNION ALL
SELECT 'reservations', COUNT(*) FROM reservations
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items;

-- ========================================
-- DUPLICATE CUSTOMER EMAILS
-- ========================================

SELECT
    LOWER(email) AS normalized_email,
    COUNT(*) AS total
FROM users
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;

-- ========================================
-- DUPLICATE TABLE NUMBERS
-- ========================================

SELECT table_number, COUNT(*)
FROM dining_tables
GROUP BY table_number
HAVING COUNT(*) > 1;

-- ========================================
-- DUPLICATE ROLE ASSIGNMENTS
-- ========================================

SELECT user_id, role_id, COUNT(*)
FROM user_roles
GROUP BY user_id, role_id
HAVING COUNT(*) > 1;

-- ========================================
-- OVERLAPPING ACTIVE BOOKINGS
-- ========================================

SELECT
    a.id AS booking_a,
    b.id AS booking_b,
    a.dining_table_id
FROM reservations a
JOIN reservations b
    ON a.dining_table_id = b.dining_table_id
   AND a.id < b.id
WHERE
    a.status IN ('pending', 'confirmed', 'seated')
    AND b.status IN ('pending', 'confirmed', 'seated')
    AND tstzrange(
        a.starts_at, a.ends_at, '[)'
    ) && tstzrange(
        b.starts_at, b.ends_at, '[)'
    );

-- ========================================
-- INVALID BOOKING CAPACITY
-- ========================================

SELECT
    r.id,
    r.party_size,
    t.capacity
FROM reservations r
JOIN dining_tables t
    ON t.id = r.dining_table_id
WHERE
    r.party_size > t.capacity
    AND r.status IN (
        'pending', 'confirmed', 'seated'
    );

-- ========================================
-- ORDER SUBTOTAL MISMATCHES
-- ========================================

SELECT
    o.id AS order_id,
    o.subtotal AS stored_subtotal,
    COALESCE(SUM(oi.line_total), 0)
        AS calculated_subtotal
FROM orders o
LEFT JOIN order_items oi
    ON oi.order_id = o.id
GROUP BY o.id, o.subtotal
HAVING o.subtotal <>
       COALESCE(SUM(oi.line_total), 0);

-- ========================================
-- ORDERS LINKED TO ANOTHER USER'S BOOKING
-- ========================================

SELECT
    o.id AS order_id,
    o.user_id AS order_user,
    r.user_id AS reservation_user
FROM orders o
JOIN reservations r
    ON r.id = o.reservation_id
WHERE o.user_id <> r.user_id;

-- ========================================
-- EXPIRED UNREVOKED SESSIONS
-- ========================================

SELECT COUNT(*) AS expired_sessions
FROM auth_sessions
WHERE expires_at < NOW()
  AND revoked_at IS NULL;

-- ========================================
-- SETTINGS
-- ========================================

SELECT key, value, value_type
FROM app_settings
ORDER BY key;
