"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { motion } from "motion/react";

import {
  ArrowUpRight,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import type { MenuItem } from "@/types/menu";
import ConfirmDialog from "@/components/ConfirmDialog";

type Toast = {
  id: number;
  message: string;
  type: "success" | "error";
};

async function readJson(
  response: Response
): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function errorMessage(
  data: Record<string, unknown>,
  fallback: string
) {
  return typeof data.error === "string"
    ? data.error
    : fallback;
}

const money = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function MenuManager() {
  const [items, setItems] = useState<MenuItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleting, setDeleting] = useState(false);

  const [selectedItem, setSelectedItem] =
    useState<MenuItem | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);

  const toastId = useRef(0);

  // Display a notification
  const notify = useCallback(
    (
      message: string,
      type: Toast["type"] = "success"
    ) => {
      setToast({
        id: ++toastId.current,
        message,
        type,
      });
    },
    []
  );

  // Automatically dismiss notifications
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4400);

    return () => window.clearTimeout(timer);
  }, [toast]);

  // Fetch all menu items from NeonDB
  const loadMenu = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch("/api/menu", {
          cache: "no-store",
          signal,
        });

        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(
            errorMessage(
              data,
              "Unable to load the menu."
            )
          );
        }

        if (!Array.isArray(data.items)) {
          throw new Error(
            "Unexpected response from the menu API."
          );
        }

        setItems(data.items as MenuItem[]);
      } catch (error) {
        if (signal?.aborted) return;

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load the menu."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Load the menu when the page opens
  useEffect(() => {
    const controller = new AbortController();

    void loadMenu(controller.signal);

    return () => controller.abort();
  }, [loadMenu]);

  // Add a menu item
  async function handleAdd(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (adding) return;

    setFormError("");

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const numericPrice = Number(price);

    if (
      !trimmedName ||
      !trimmedDescription ||
      !price.trim() ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setFormError(
        "Please enter a name, positive price, and description."
      );

      return;
    }

    setAdding(true);

    try {
      const response = await fetch("/api/menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          price,
          description: trimmedDescription,
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(data, "Unable to add the dish.")
        );
      }

      if (!data.item) {
        throw new Error(
          "The server did not return the new dish."
        );
      }

      const newItem = data.item as MenuItem;

      // Immediately update the visible menu
      setItems((current) => [
        newItem,
        ...current,
      ]);

      setName("");
      setPrice("");
      setDescription("");
      setLoadError("");

      notify(
        "Your new dish has been added to the menu!"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to add the dish.";

      setFormError(message);
      notify(message, "error");
    } finally {
      setAdding(false);
    }
  }

  // Delete the selected item
  async function handleDelete() {
    if (!selectedItem || deleting) return;

    const id = selectedItem.id;

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/menu/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(
            data,
            "Unable to remove the dish."
          )
        );
      }

      // Remove the card immediately
      setItems((current) =>
        current.filter((item) => item.id !== id)
      );

      setSelectedItem(null);

      notify(
        "Dish successfully removed from the menu."
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to remove the dish.",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section
      id="menu"
      className="section menu-section"
      aria-labelledby="menu-title"
    >
      <div className="container-wide">
        {/* Section heading */}
        <motion.div
          className="section-intro centered"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow eyebrow-dark">
            <span className="eyebrow-line" />
            THE GOOD STUFF
          </p>

          <h2
            id="menu-title"
            className="section-heading"
          >
            A menu made <em>with love.</em>
          </h2>

          <p>
            Fresh flavors, thoughtful combinations,
            and something to look forward to with
            every bite.
          </p>
        </motion.div>

        {/* Menu heading */}
        <div className="menu-heading-row">
          <div>
            <span className="section-overline">
              THE COLLECTION
            </span>

            <h3>
              Explore our dishes{" "}
              <span className="menu-count">
                {!loading && !loadError
                  ? String(items.length).padStart(
                      2,
                      "0"
                    )
                  : "—"}
              </span>
            </h3>
          </div>

          <a
            href="#add-item"
            className="text-link"
          >
            Add a new dish
            <ArrowUpRight size={18} />
          </a>
        </div>

        {/* Loading skeletons */}
        {loading ? (
          <div
            className="menu-grid"
            aria-label="Loading menu"
            aria-busy="true"
          >
            {[0, 1, 2].map((n) => (
              <div
                className="menu-card skeleton-card"
                key={n}
              >
                <div className="skeleton skeleton-icon" />
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line short" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          // Database error state
          <div
            className="menu-empty"
            role="alert"
          >
            <span className="empty-icon error-icon">
              <CircleAlert size={28} />
            </span>

            <h3>We couldn&apos;t load the menu.</h3>

            <p>{loadError}</p>

            <button
              className="button button-primary"
              type="button"
              onClick={() => void loadMenu()}
            >
              <RefreshCw size={17} />
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          // Empty database state
          <div className="menu-empty">
            <span className="empty-icon">
              <ChefHat size={34} />
            </span>

            <h3>A beautiful menu starts here.</h3>

            <p>
              No dishes have been added yet.
              Add your first creation below
              and it will appear here.
            </p>

            <a
              href="#add-item"
              className="button button-primary"
            >
              Add the first dish
              <Plus size={17} />
            </a>
          </div>
        ) : (
          // Dynamic menu cards from NeonDB
          <div className="menu-grid">
            {items.map((item, index) => (
              <motion.article
                className="menu-card"
                key={item.id}
                initial={{
                  opacity: 0,
                  y: 18,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(
                    index * 0.04,
                    0.28
                  ),
                }}
              >
                <div className="menu-card-top">
                  <span
                    className="dish-monogram"
                    aria-hidden="true"
                  >
                    <ChefHat
                      size={23}
                      strokeWidth={1.35}
                    />
                  </span>

                  <span className="dish-category">
                    SAVORIA SELECTION
                  </span>
                </div>

                <div className="menu-card-title-row">
                  <h4>{item.name}</h4>

                  <span className="dish-price">
                    <small>PKR</small>{" "}
                    {money.format(item.price)}
                  </span>
                </div>

                <p>{item.description}</p>

                <div className="card-bottom">
                  <span>CRAFTED FOR YOU</span>

                  <button
                    className="remove-button"
                    type="button"
                    aria-label={`Delete ${item.name}`}
                    onClick={() =>
                      setSelectedItem(item)
                    }
                  >
                    <Trash2 size={16} />
                    Remove
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {/* Add new menu item */}
        <div
          id="add-item"
          className="add-section"
        >
          <div className="add-intro">
            <span className="section-overline">
              CURATE THE MENU
            </span>

            <h3>
              Add something <em>delicious.</em>
            </h3>

            <p>
              Have a new favorite in mind?
              Give it a name, set the price,
              and tell us what makes it special.
            </p>

            <div
              className="add-illustration"
              aria-hidden="true"
            >
              <ChefHat
                size={76}
                strokeWidth={0.8}
              />

              <span>MADE WITH HEART</span>
            </div>
          </div>

          <form
            className="add-form"
            onSubmit={(event) =>
              void handleAdd(event)
            }
            noValidate
          >
            <div className="form-label-heading">
              NEW MENU ITEM
              <span>✳</span>
            </div>

            {/* Name */}
            <div className="field">
              <label htmlFor="dish-name">
                Dish name <span>*</span>
              </label>

              <input
                id="dish-name"
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="e.g. Truffle Mushroom Risotto"
                required
                maxLength={100}
                disabled={adding}
              />
            </div>

            {/* Price */}
            <div className="field">
              <label htmlFor="dish-price">
                Price (PKR) <span>*</span>
              </label>

              <div className="price-field">
                <span>Rs.</span>

                <input
                  id="dish-price"
                  type="number"
                  value={price}
                  onChange={(e) =>
                    setPrice(e.target.value)
                  }
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  placeholder="1250.00"
                  required
                  disabled={adding}
                />
              </div>
            </div>

            {/* Description */}
            <div className="field">
              <label htmlFor="dish-description">
                Description <span>*</span>
              </label>

              <textarea
                id="dish-description"
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="A few delicious details about this dish..."
                rows={4}
                required
                maxLength={500}
                disabled={adding}
              />
            </div>

            {/* Validation error */}
            {formError && (
              <p
                className="form-error"
                role="alert"
              >
                <CircleAlert size={17} />
                {formError}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className="button button-primary form-submit"
              disabled={adding}
            >
              {adding
                ? "Adding your dish..."
                : "Add Menu Item"}

              {adding ? (
                <span className="small-spinner" />
              ) : (
                <Plus size={19} />
              )}
            </button>

            <p className="form-note">
              All changes are saved to the
              restaurant database.
            </p>
          </form>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        item={selectedItem}
        busy={deleting}
        onCancel={() => {
          if (!deleting) {
            setSelectedItem(null);
          }
        }}
        onConfirm={() =>
          void handleDelete()
        }
      />

      {/* Toast notification */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          role="status"
          aria-live="polite"
          key={toast.id}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={21} />
          ) : (
            <CircleAlert size={21} />
          )}

          <span>{toast.message}</span>

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </section>
  );
}