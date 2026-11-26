
import "server-only";
import { getDatabase } from "@/lib/db";

export type RestaurantSettings = {
  restaurant_name: string;
  currency_code: string;
  restaurant_timezone: string;
  booking_duration_minutes: number;
  booking_advance_days: number;
  booking_max_party_size: number;
  allow_online_booking: boolean;
  tax_rate_percent: number;
  service_charge_percent: number;
  opening_hours: Record<string, unknown>;
};

export async function getRestaurantSettings():
  Promise<RestaurantSettings> {

  const sql = getDatabase();

  const rows = await sql`
    SELECT key, value
    FROM app_settings
  `;

  const settings = Object.fromEntries(
    rows.map((row) => [row.key, row.value])
  ) as Record<string, unknown>;

  const requiredKeys: (keyof RestaurantSettings)[] = [
    "restaurant_name",
    "currency_code",
    "restaurant_timezone",
    "booking_duration_minutes",
    "booking_advance_days",
    "booking_max_party_size",
    "allow_online_booking",
    "tax_rate_percent",
    "service_charge_percent",
    "opening_hours",
  ];

  for (const key of requiredKeys) {
    if (!(key in settings)) {
      throw new Error(
        `Required setting missing: ${key}`
      );
    }
  }

  const stringKeys = [
    "restaurant_name",
    "currency_code",
    "restaurant_timezone",
  ];

  const numericKeys = [
    "booking_duration_minutes",
    "booking_advance_days",
    "booking_max_party_size",
    "tax_rate_percent",
    "service_charge_percent",
  ];

  for (const key of stringKeys) {
    if (typeof settings[key] !== "string") {
      throw new Error(`Invalid setting: ${key}`);
    }
  }

  for (const key of numericKeys) {
    if (
      typeof settings[key] !== "number" ||
      !Number.isFinite(settings[key])
    ) {
      throw new Error(`Invalid setting: ${key}`);
    }
  }

  if (typeof settings.allow_online_booking !== "boolean") {
    throw new Error("Invalid online booking setting");
  }

  if (
    !settings.opening_hours ||
    typeof settings.opening_hours !== "object" ||
    Array.isArray(settings.opening_hours)
  ) {
    throw new Error("Invalid opening hours setting");
  }

  return settings as RestaurantSettings;
}
