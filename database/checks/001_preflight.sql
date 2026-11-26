
-- ========================================
-- CHECK 1: DATABASE VERSION
-- ========================================

SELECT version();

-- ========================================
-- CHECK 2: EXISTING MENU TABLE
-- ========================================

SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'menu_items';

-- ========================================
-- CHECK 3: EXISTING MENU COLUMNS
-- ========================================

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'menu_items'
ORDER BY ordinal_position;

-- ========================================
-- CHECK 4: DUPLICATE MENU NAMES
-- Run after confirming the table exists.
-- ========================================

SELECT
    LOWER(BTRIM(name)) AS normalized_name,
    COUNT(*) AS duplicate_count,
    ARRAY_AGG(id ORDER BY id) AS record_ids
FROM menu_items
GROUP BY LOWER(BTRIM(name))
HAVING COUNT(*) > 1;

-- ========================================
-- CHECK 5: INVALID MENU RECORDS
-- ========================================

SELECT *
FROM menu_items
WHERE
    name IS NULL
    OR LENGTH(BTRIM(name)) = 0
    OR description IS NULL
    OR LENGTH(BTRIM(description)) = 0
    OR price IS NULL
    OR price <= 0;

-- ========================================
-- CHECK 6: EXISTING MENU COUNT
-- ========================================

SELECT COUNT(*) AS existing_menu_count
FROM menu_items;
