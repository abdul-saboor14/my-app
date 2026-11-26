
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { motion } from "motion/react";

import {
  ArrowUpRight,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Save,
} from "lucide-react";

import type { MenuItem } from "@/types/menu";
import ConfirmDialog from "@/components/ConfirmDialog";

type Toast = {
  id: number;
  message: string;
  type: "success" | "error";
};

const money = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

async function readJson(
  response: Response
): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
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

export default function MenuManager({
  editable = false,
}: {
  editable?: boolean;
}) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Add dish form
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit dish form
  const [editingItem, setEditingItem] =
    useState<MenuItem | null>(null);

  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete dialog
  const [selectedItem, setSelectedItem] =
    useState<MenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Notifications
  const [toast, setToast] = useState<Toast | null>(null);
  const toastId = useRef(0);

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

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(
      () => setToast(null),
      4400
    );

    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadMenu = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch("/api/menu", {
          cache: "no-store",
          signal,
        });

        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(
            errorMessage(data, "Unable to load menu.")
          );
        }

        if (!Array.isArray(data.items)) {
          throw new Error("Unexpected menu response.");
        }

        if (!signal?.aborted) {
          setItems(data.items as MenuItem[]);
          setLoadError("");
        }
      } catch (error) {
        if (signal?.aborted) return;

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load menu."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadMenu(controller.signal);

    return () => controller.abort();
  }, [loadMenu]);

  // OPEN EDIT FORM
  function startEdit(item: MenuItem) {
    setEditingItem(item);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditDescription(item.description);
    setEditError("");
  }

  // SAVE EDITED DISH
  async function handleEdit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingItem || saving) return;

    setEditError("");

    const numericPrice = Number(editPrice);

    if (
      !editName.trim() ||
      !editDescription.trim() ||
      !editPrice.trim() ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setEditError(
        "Enter a valid name, price and description."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/menu/${editingItem.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editName.trim(),
            price: editPrice,
            description: editDescription.trim(),
          }),
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(data, "Unable to update dish.")
        );
      }

      const updated = data.item as MenuItem | undefined;

      if (!updated) {
        throw new Error("Updated item not returned.");
      }

      setItems((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item
        )
      );

      setEditingItem(null);
      notify("Dish updated successfully!");
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : "Unable to save changes."
      );
    } finally {
      setSaving(false);
    }
  }

  // ADD NEW DISH
  async function handleAdd(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (adding) return;

    setFormError("");

    const numericPrice = Number(price);

    if (
      !name.trim() ||
      !description.trim() ||
      !price.trim() ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setFormError(
        "Enter a valid name, price and description."
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
          name: name.trim(),
          price,
          description: description.trim(),
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(data, "Unable to add dish.")
        );
      }

      const newItem = data.item as MenuItem | undefined;

      if (!newItem) {
        throw new Error("New item not returned.");
      }

      setItems((current) => [newItem, ...current]);
      setName("");
      setPrice("");
      setDescription("");

      notify("Dish added successfully!");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to add dish."
      );
    } finally {
      setAdding(false);
    }
  }

  // DELETE DISH
  async function handleDelete() {
    if (!selectedItem || deleting) return;

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/menu/${selectedItem.id}`,
        { method: "DELETE" }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(data, "Unable to delete dish.")
        );
      }

      setItems((current) =>
        current.filter(
          (item) => item.id !== selectedItem.id
        )
      );

      setSelectedItem(null);
      notify("Dish removed successfully!");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to delete dish.",
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

        <div className="menu-heading-row">
          <div>
            <span className="section-overline">
              THE COLLECTION
            </span>

            <h3>
              Explore our dishes{" "}
              <span className="menu-count">
                {!loading && !loadError
                  ? String(items.length).padStart(2, "0")
                  : "—"}
              </span>
            </h3>
          </div>

          {editable && (
            <a href="#add-item" className="text-link">
              Add a new dish
              <ArrowUpRight size={18} />
            </a>
          )}
        </div>

        {loading ? (
          <div
            className="menu-grid"
            aria-label="Loading menu"
            aria-busy="true"
          >
            {[0, 1, 2].map((n) => (
              <div className="menu-card skeleton-card" key={n}>
                <div className="skeleton skeleton-icon" />
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line short" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="menu-empty" role="alert">
            <span className="empty-icon error-icon">
              <CircleAlert size={28} />
            </span>

            <h3>We couldn&apos;t load the menu.</h3>
            <p>{loadError}</p>

            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                setLoading(true);
                setLoadError("");
                void loadMenu();
              }}
            >
              <RefreshCw size={17} />
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="menu-empty">
            <span className="empty-icon">
              <ChefHat size={34} />
            </span>
            <h3>A beautiful menu starts here.</h3>
            <p>
              No dishes have been added yet.
              {editable
                ? " Add your first dish below."
                : " Check back soon."}
            </p>
          </div>
        ) : (
          <div className="menu-grid">
            {items.map((item, index) => (
              <motion.article
                className="menu-card"
                key={item.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(index * 0.04, 0.28),
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

                  {editable && (
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="remove-button"
                        style={{ color: "#54775B" }}
                        onClick={() => startEdit(item)}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className="remove-button"
                        onClick={() =>
                          setSelectedItem(item)
                        }
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline edit form */}
                {editable &&
                  editingItem?.id === item.id && (
                    <form
                      onSubmit={(event) =>
                        void handleEdit(event)
                      }
                      style={{
                        marginTop: 22,
                        paddingTop: 20,
                        borderTop: "1px solid #e2d9cc",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: 20,
                          marginBottom: 18,
                        }}
                      >
                        Edit this dish
                      </h4>

                      <div className="field">
                        <label htmlFor={`edit-name-${item.id}`}>
                          Dish name
                        </label>

                        <input
                          id={`edit-name-${item.id}`}
                          value={editName}
                          onChange={(e) =>
                            setEditName(e.target.value)
                          }
                          maxLength={100}
                          disabled={saving}
                          required
                        />
                      </div>

                      <div className="field">
                        <label htmlFor={`edit-price-${item.id}`}>
                          Price (PKR)
                        </label>

                        <input
                          id={`edit-price-${item.id}`}
                          type="number"
                          min="0.01"
                          max="99999999.99"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) =>
                            setEditPrice(e.target.value)
                          }
                          disabled={saving}
                          required
                        />
                      </div>

                      <div className="field">
                        <label
                          htmlFor={`edit-description-${item.id}`}
                        >
                          Description
                        </label>

                        <textarea
                          id={`edit-description-${item.id}`}
                          rows={3}
                          maxLength={500}
                          value={editDescription}
                          onChange={(e) =>
                            setEditDescription(e.target.value)
                          }
                          disabled={saving}
                          required
                        />
                      </div>

                      {editError && (
                        <p className="form-error" role="alert">
                          <CircleAlert size={17} />
                          {editError}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="submit"
                          className="button button-primary"
                          disabled={saving}
                        >
                          <Save size={16} />
                          {saving
                            ? "Saving..."
                            : "Save Changes"}
                        </button>

                        <button
                          type="button"
                          className="button button-outline"
                          disabled={saving}
                          onClick={() =>
                            setEditingItem(null)
                          }
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
              </motion.article>
            ))}
          </div>
        )}

        {/* Add a new dish */}
        {editable && (
          <div id="add-item" className="add-section">
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
            >
              <div className="form-label-heading">
                NEW MENU ITEM
                <span>✳</span>
              </div>

              <div className="field">
                <label htmlFor="dish-name">
                  Dish name <span>*</span>
                </label>

                <input
                  id="dish-name"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="e.g. Truffle Mushroom Risotto"
                  maxLength={100}
                  required
                  disabled={adding}
                />
              </div>

              <div className="field">
                <label htmlFor="dish-price">
                  Price (PKR) <span>*</span>
                </label>

                <div className="price-field">
                  <span>Rs.</span>

                  <input
                    id="dish-price"
                    type="number"
                    min="0.01"
                    max="99999999.99"
                    step="0.01"
                    value={price}
                    onChange={(e) =>
                      setPrice(e.target.value)
                    }
                    placeholder="1250.00"
                    required
                    disabled={adding}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="dish-description">
                  Description <span>*</span>
                </label>

                <textarea
                  id="dish-description"
                  rows={4}
                  maxLength={500}
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Describe your dish..."
                  required
                  disabled={adding}
                />
              </div>

              {formError && (
                <p className="form-error" role="alert">
                  <CircleAlert size={17} />
                  {formError}
                </p>
              )}

              <button
                type="submit"
                className="button button-primary form-submit"
                disabled={adding}
              >
                {adding
                  ? "Adding your dish..."
                  : "Add Menu Item"}
                <Plus size={19} />
              </button>

              <p className="form-note">
                All changes are saved to the
                restaurant database.
              </p>
            </form>
          </div>
        )}
      </div>

      {/* Existing delete confirmation */}
      {editable && (
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
      )}

      {/* Notification */}
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
