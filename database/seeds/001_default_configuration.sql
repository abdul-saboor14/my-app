
BEGIN;

-- ========================================
-- DEFAULT ROLES
-- ========================================

INSERT INTO roles (name, description)
VALUES
(
    'user',
    'Customer account with booking and ordering access'
),
(
    'admin',
    'Restaurant administrator with management access'
)
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- RESTAURANT SETTINGS
-- ========================================

INSERT INTO app_settings
(key, value, value_type, description)
VALUES

(
    'restaurant_name',
    '"Savoria"',
    'string',
    'Restaurant display name'
),

(
    'currency_code',
    '"PKR"',
    'string',
    'Currency used for menu and orders'
),

(
    'restaurant_timezone',
    '"Asia/Karachi"',
    'string',
    'Timezone for restaurant reservations'
),

(
    'booking_duration_minutes',
    '90',
    'number',
    'Default reservation duration'
),

(
    'booking_advance_days',
    '30',
    'number',
    'Maximum days in advance for bookings'
),

(
    'booking_max_party_size',
    '12',
    'number',
    'Maximum guests allowed per reservation'
),

(
    'allow_online_booking',
    'true',
    'boolean',
    'Enable or disable online reservations'
),

(
    'tax_rate_percent',
    '0',
    'number',
    'Example tax configuration'
),

(
    'service_charge_percent',
    '0',
    'number',
    'Example service charge configuration'
),

(
    'opening_hours',
    '{}',
    'object',
    'Weekly opening hours; configure before enabling bookings'
)

ON CONFLICT (key) DO NOTHING;

COMMIT;
