
BEGIN;

-- Required for time-range exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ====================================================
-- 1. USERS
-- ====================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,

    phone VARCHAR(30),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_name_not_empty
        CHECK (LENGTH(BTRIM(full_name)) > 0),

    CONSTRAINT users_email_not_empty
        CHECK (
            LENGTH(BTRIM(email)) > 3
            AND email = BTRIM(email)
        )
);

-- Emails must be unique regardless of capitalization.
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email
ON users (LOWER(email));

-- ====================================================
-- 2. ROLES
-- ====================================================

CREATE TABLE IF NOT EXISTS roles (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(30) NOT NULL UNIQUE,

    description TEXT,

    CONSTRAINT roles_allowed_names
        CHECK (name IN ('user', 'admin'))
);

-- ====================================================
-- 3. USER ROLE ASSIGNMENTS
-- ====================================================

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    role_id SMALLINT NOT NULL
        REFERENCES roles(id) ON DELETE RESTRICT,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
ON user_roles(role_id);

-- ====================================================
-- 4. PASSWORD CREDENTIALS
-- ====================================================

CREATE TABLE IF NOT EXISTS credentials (
    user_id BIGINT PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    password_hash TEXT NOT NULL,

    password_updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    failed_attempts INTEGER NOT NULL DEFAULT 0,

    locked_until TIMESTAMPTZ,

    CONSTRAINT password_hash_not_empty
        CHECK (LENGTH(password_hash) > 0),

    CONSTRAINT failed_attempts_nonnegative
        CHECK (failed_attempts >= 0)
);

-- Passwords must be hashed by the application
-- using Argon2id or a similarly secure method.
-- NEVER store plaintext passwords.

-- ====================================================
-- 5. AUTHENTICATION SESSIONS
-- ====================================================

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,

    CONSTRAINT session_expiry_valid
        CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user
ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
ON auth_sessions(expires_at);

-- ====================================================
-- 6. DINING TABLES
-- ====================================================

CREATE TABLE IF NOT EXISTS dining_tables (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    table_number VARCHAR(30) NOT NULL UNIQUE,

    capacity INTEGER NOT NULL,

    location VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT table_number_not_empty
        CHECK (LENGTH(BTRIM(table_number)) > 0),

    CONSTRAINT table_capacity_valid
        CHECK (capacity BETWEEN 1 AND 100)
);

-- ====================================================
-- 7. EXISTING MENU ITEMS
-- ====================================================

-- If menu_items does not exist, create it.
-- If it exists, preserve its existing records.

CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    description TEXT NOT NULL
);

-- Extend existing table without deleting data.

ALTER TABLE menu_items
    ADD COLUMN IF NOT EXISTS category VARCHAR(80),
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN
        NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW();

-- Enforce menu data quality even for legacy tables.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'menu_items'::regclass
          AND conname = 'menu_price_positive'
    ) THEN
        ALTER TABLE menu_items
        ADD CONSTRAINT menu_price_positive
        CHECK (price > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'menu_items'::regclass
          AND conname = 'menu_name_not_empty'
    ) THEN
        ALTER TABLE menu_items
        ADD CONSTRAINT menu_name_not_empty
        CHECK (LENGTH(BTRIM(name)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'menu_items'::regclass
          AND conname = 'menu_description_not_empty'
    ) THEN
        ALTER TABLE menu_items
        ADD CONSTRAINT menu_description_not_empty
        CHECK (LENGTH(BTRIM(description)) > 0);
    END IF;
END;
$$;

-- Prevent duplicate names differing only by case
-- or surrounding spaces.
CREATE UNIQUE INDEX IF NOT EXISTS ux_menu_name
ON menu_items (LOWER(BTRIM(name)));

CREATE INDEX IF NOT EXISTS idx_menu_available
ON menu_items(is_available);

CREATE INDEX IF NOT EXISTS idx_menu_category
ON menu_items(category);

-- ====================================================
-- 8. TABLE RESERVATIONS
-- ====================================================

CREATE TABLE IF NOT EXISTS reservations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    dining_table_id BIGINT NOT NULL
        REFERENCES dining_tables(id) ON DELETE RESTRICT,

    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,

    party_size INTEGER NOT NULL,

    status VARCHAR(25) NOT NULL DEFAULT 'pending',

    special_requests TEXT,

    idempotency_key UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reservation_time_valid
        CHECK (ends_at > starts_at),

    CONSTRAINT reservation_party_valid
        CHECK (party_size BETWEEN 1 AND 100),

    CONSTRAINT reservation_status_valid
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'seated',
                'completed',
                'cancelled',
                'no_show'
            )
        ),

    CONSTRAINT reservation_request_unique
        UNIQUE (user_id, idempotency_key)
);

-- Prevent overlapping active reservations
-- for the SAME dining table.
ALTER TABLE reservations
ADD CONSTRAINT no_overlapping_reservations
EXCLUDE USING gist (
    dining_table_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
)
WHERE (
    status IN ('pending', 'confirmed', 'seated')
);

CREATE INDEX IF NOT EXISTS idx_reservations_user
ON reservations(user_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservations_status_time
ON reservations(status, starts_at);

-- ====================================================
-- 9. ORDERS
-- ====================================================

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    reservation_id BIGINT
        REFERENCES reservations(id) ON DELETE RESTRICT,

    order_type VARCHAR(25) NOT NULL DEFAULT 'dine_in',

    status VARCHAR(25) NOT NULL DEFAULT 'pending',

    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    service_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    payment_status VARCHAR(25) NOT NULL DEFAULT 'unpaid',

    idempotency_key UUID NOT NULL,

    customer_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT order_type_valid
        CHECK (order_type IN ('dine_in', 'takeaway')),

    CONSTRAINT order_status_valid
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'preparing',
                'ready',
                'served',
                'completed',
                'cancelled'
            )
        ),

    CONSTRAINT payment_status_valid
        CHECK (
            payment_status IN (
                'unpaid',
                'paid',
                'refunded',
                'partially_refunded'
            )
        ),

    CONSTRAINT order_amounts_nonnegative
        CHECK (
            subtotal >= 0
            AND tax_amount >= 0
            AND service_amount >= 0
            AND total_amount >= 0
        ),

    CONSTRAINT order_total_valid
        CHECK (
            total_amount =
            subtotal + tax_amount + service_amount
        ),

    CONSTRAINT order_request_unique
        UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_orders_user
ON orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_reservation
ON orders(reservation_id);

-- ====================================================
-- 10. ORDER ITEMS
-- ====================================================

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,

    menu_item_id INTEGER NOT NULL
        REFERENCES menu_items(id) ON DELETE RESTRICT,

    item_name TEXT NOT NULL,

    quantity INTEGER NOT NULL,

    unit_price NUMERIC(10,2) NOT NULL,

    line_total NUMERIC(12,2)
        GENERATED ALWAYS AS (quantity * unit_price)
        STORED,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT item_quantity_valid
        CHECK (quantity > 0),

    CONSTRAINT item_price_valid
        CHECK (unit_price >= 0),

    CONSTRAINT item_name_not_empty
        CHECK (LENGTH(BTRIM(item_name)) > 0),

    CONSTRAINT one_line_per_menu_item
        UNIQUE (order_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_menu
ON order_items(menu_item_id);

-- ====================================================
-- 11. DATABASE SYSTEM SETTINGS
-- ====================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,

    value JSONB NOT NULL,

    value_type VARCHAR(20) NOT NULL,

    description TEXT,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT setting_type_valid
        CHECK (
            value_type IN (
                'string',
                'number',
                'boolean',
                'object',
                'array'
            )
        ),

    CONSTRAINT setting_json_type_matches
        CHECK (jsonb_typeof(value) = value_type),

    CONSTRAINT setting_known_value_valid
        CHECK (
            CASE
                WHEN key IN (
                    'booking_duration_minutes',
                    'booking_advance_days',
                    'booking_max_party_size'
                )
                THEN
                    value_type = 'number'
                    AND (
                        CASE
                            WHEN value_type = 'number'
                            THEN (value #>> '{}')::numeric
                            ELSE NULL
                        END
                    ) BETWEEN 1 AND 36500

                WHEN key IN (
                    'tax_rate_percent',
                    'service_charge_percent'
                )
                THEN
                    value_type = 'number'
                    AND (
                        CASE
                            WHEN value_type = 'number'
                            THEN (value #>> '{}')::numeric
                            ELSE NULL
                        END
                    ) BETWEEN 0 AND 100

                WHEN key = 'allow_online_booking'
                THEN value_type = 'boolean'

                WHEN key IN (
                    'restaurant_name',
                    'restaurant_timezone',
                    'currency_code'
                )
                THEN value_type = 'string'
                     AND LENGTH(value #>> '{}') > 0

                WHEN key = 'opening_hours'
                THEN value_type = 'object'

                ELSE TRUE
            END
        )
);

-- ====================================================
-- 12. RESERVATION CAPACITY VALIDATION
-- ====================================================

CREATE OR REPLACE FUNCTION check_reservation_capacity()
RETURNS TRIGGER AS $$
DECLARE
    table_capacity INTEGER;
    table_is_active BOOLEAN;
    configured_max INTEGER;
BEGIN
    -- Only block or validate active reservations.
    IF NEW.status NOT IN (
        'pending', 'confirmed', 'seated'
    ) THEN
        RETURN NEW;
    END IF;

    SELECT capacity, is_active
    INTO table_capacity, table_is_active
    FROM dining_tables
    WHERE id = NEW.dining_table_id
    FOR UPDATE;

    IF table_capacity IS NULL THEN
        RAISE EXCEPTION 'Dining table does not exist';
    END IF;

    IF NOT table_is_active THEN
        RAISE EXCEPTION 'Dining table is not active';
    END IF;

    IF NEW.party_size > table_capacity THEN
        RAISE EXCEPTION
            'Party size exceeds table capacity';
    END IF;

    SELECT (value #>> '{}')::INTEGER
    INTO configured_max
    FROM app_settings
    WHERE key = 'booking_max_party_size';

    IF configured_max IS NOT NULL
       AND NEW.party_size > configured_max THEN
        RAISE EXCEPTION
            'Party size exceeds restaurant booking limit';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_capacity
BEFORE INSERT OR UPDATE OF
    dining_table_id, party_size, status
ON reservations
FOR EACH ROW
EXECUTE FUNCTION check_reservation_capacity();

-- ====================================================
-- 13. AUTOMATIC UPDATED_AT TIMESTAMPS
-- ====================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tables_updated
BEFORE UPDATE ON dining_tables
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_menu_updated
BEFORE UPDATE ON menu_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reservations_updated
BEFORE UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_settings_updated
BEFORE UPDATE ON app_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
