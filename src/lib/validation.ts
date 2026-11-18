export type ValidMenuInput = {
  name: string;
  price: number;
  description: string;
};

type ValidationResult =
  | {
      success: true;
      data: ValidMenuInput;
    }
  | {
      success: false;
      error: string;
    };

export function validateMenuInput(
  value: unknown
): ValidationResult {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {
      success: false,
      error: "Please provide a valid menu item.",
    };
  }

  const input = value as Record<string, unknown>;

  if (
    typeof input.name !== "string" ||
    !input.name.trim()
  ) {
    return {
      success: false,
      error: "Dish name is required.",
    };
  }

  const name = input.name.trim();

  if (name.length > 100) {
    return {
      success: false,
      error: "Dish name cannot exceed 100 characters.",
    };
  }

  if (
    typeof input.description !== "string" ||
    !input.description.trim()
  ) {
    return {
      success: false,
      error: "Description is required.",
    };
  }

  const description = input.description.trim();

  if (description.length > 500) {
    return {
      success: false,
      error: "Description cannot exceed 500 characters.",
    };
  }

  const rawPrice = input.price;

  if (
    typeof rawPrice !== "string" &&
    typeof rawPrice !== "number"
  ) {
    return {
      success: false,
      error: "A valid price is required.",
    };
  }

  const priceText = String(rawPrice).trim();

  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(priceText)) {
    return {
      success: false,
      error:
        "Price must have at most 8 whole digits and 2 decimal places.",
    };
  }

  const price = Number(priceText);

  if (!Number.isFinite(price) || price <= 0) {
    return {
      success: false,
      error: "Price must be greater than zero.",
    };
  }

  return {
    success: true,
    data: {
      name,
      price,
      description,
    },
  };
}