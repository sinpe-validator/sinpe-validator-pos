import { useEffect, useState } from "react";
import { getOrdersFiltered } from "../services/api";

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeStatus(status) {
  const s = String(status ?? "")
    .toLowerCase()
    .trim();

  if (s === "2" || s === "paid") return "paid";
  if (s === "3" || s === "expired") return "expired";

  if (s === "4" || s === "underreview" || s === "under_review") {
    return "underreview";
  }

  return "pending";
}

const STATUS_LABELS = {
  pending: "Pendiente",
  paid: "Pagado",
  expired: "Expirado",
  underreview: "En revisión",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "Pending", label: "Pendiente" },
  { value: "Paid", label: "Pagado" },
  { value: "Expired", label: "Expirado" },
  { value: "UnderReview", label: "En revisión" },
];

function StatusPill({ status }) {
  const normalized = normalizeStatus(status);

  return (
    <span className={`status-pill status-pill--${normalized}`}>
      {STATUS_LABELS[normalized] ?? status}
    </span>
  );
}

const EMPTY_FILTERS = {
  fechaDesde: "",
  fechaHasta: "",
  estado: "",
  montoMin: "",
  montoMax: "",
};

export default function History() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const hasActiveFilters = Object.values(appliedFilters).some(
    (value) => value !== "",
  );

  async function fetchOrders(params = {}) {
    setIsLoading(true);
    setError("");

    try {
      const data = await getOrdersFiltered(params);
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setError("No se pudo conectar con el servidor.");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders({});
  }, []);

  function handleFilterChange(field, value) {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleSearch(event) {
    event.preventDefault();
    setAppliedFilters(filters);
    fetchOrders(filters);
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    fetchOrders({});
  }

  const totalAmount = orders.reduce((sum, order) => {
    return sum + Number(order.amount ?? order.Amount ?? 0);
  }, 0);

  const paidCount = orders.filter((order) => {
    return normalizeStatus(order.status ?? order.Status) === "paid";
  }).length;

  return (
    <div className="page-container history-page">
      <div className="page-header">
        <div>
          <p className="section-label">Pagos SINPE</p>
          <h1>Historial de pagos</h1>
          <p>Consultá y filtrá todas las órdenes registradas en el sistema.</p>
        </div>

        <div className="summary-cards">
          <article className="summary-card">
            <span>Total órdenes</span>
            <strong>{orders.length}</strong>
          </article>

          <article className="summary-card">
            <span>Pagadas</span>
            <strong>{paidCount}</strong>
          </article>

          <article className="summary-card">
            <span>Monto total</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </article>
        </div>
      </div>

      <section className="orders-section">
        <div className="section-heading">
          <div>
            <p className="section-label">Resultados</p>
            <h2>
              {isLoading
                ? "Cargando..."
                : `${orders.length} orden${
                    orders.length !== 1 ? "es" : ""
                  } encontrada${orders.length !== 1 ? "s" : ""}`}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSearch}>
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Descripción</th>
                  <th>Creada</th>
                  <th>Expira</th>
                </tr>

                <tr className="table-filter-row">
                  <th>
                    <span className="table-filter-title">Filtros</span>
                  </th>

                  <th>
                    <div className="table-filter-stack">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Mínimo"
                        value={filters.montoMin}
                        onChange={(event) =>
                          handleFilterChange("montoMin", event.target.value)
                        }
                      />

                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Máximo"
                        value={filters.montoMax}
                        onChange={(event) =>
                          handleFilterChange("montoMax", event.target.value)
                        }
                      />
                    </div>
                  </th>

                  <th>
                    <select
                      value={filters.estado}
                      onChange={(event) =>
                        handleFilterChange("estado", event.target.value)
                      }
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </th>

                  <th className="table-filter-empty"></th>

                  <th>
                    <div className="table-filter-stack">
                      <input
                        type="date"
                        value={filters.fechaDesde}
                        onChange={(event) =>
                          handleFilterChange("fechaDesde", event.target.value)
                        }
                      />

                      <input
                        type="date"
                        value={filters.fechaHasta}
                        onChange={(event) =>
                          handleFilterChange("fechaHasta", event.target.value)
                        }
                      />
                    </div>
                  </th>

                  <th>
                    <div className="table-filter-actions">
                      <button
                        type="submit"
                        className="primary-action table-action-button"
                      >
                        Buscar
                      </button>

                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="secondary-action table-action-button"
                          onClick={handleClear}
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {error ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state" role="alert">
                        <p>{error}</p>
                        <span>Verificá la conexión con el servidor.</span>
                      </div>
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <p>Cargando historial de pagos...</p>
                      </div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <p>No se encontraron órdenes.</p>
                        <span>
                          {hasActiveFilters
                            ? "Intentá con otros filtros."
                            : "Aún no hay órdenes registradas."}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const id = order.idOrder ?? order.IdOrder;
                    const code = order.orderCode ?? order.OrderCode ?? "";
                    const amount = Number(order.amount ?? order.Amount ?? 0);
                    const status = order.status ?? order.Status ?? "";
                    const description =
                      order.description ?? order.Description ?? "";
                    const createdAt = order.createdAt ?? order.CreatedAt;
                    const expiresAt = order.expiresAt ?? order.ExpiresAt;

                    return (
                      <tr key={id}>
                        <td className="mono">{code}</td>

                        <td>{formatCurrency(amount)}</td>

                        <td>
                          <StatusPill status={status} />
                        </td>

                        <td>
                          {description || (
                            <span className="text-muted">Sin descripción</span>
                          )}
                        </td>

                        <td>
                          <div className="timestamp-cell">
                            <span>
                              {createdAt ? formatDateTime(createdAt) : "—"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="timestamp-cell">
                            <span>
                              {expiresAt ? formatDateTime(expiresAt) : "—"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </form>
      </section>
    </div>
  );
}