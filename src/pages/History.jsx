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
  if (s === "4" || s === "underreview" || s === "under_review")
    return "underreview";
  return "pending";
}

const STATUS_LABELS = {
  pending: "Pendiente",
  paid: "Pagado",
  expired: "Expirado",
  underreview: "En revisión",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
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

  // Filtros que el usuario está editando
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Filtros aplicados (los que se usaron en la última búsqueda)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const hasActiveFilters = Object.values(appliedFilters).some((v) => v !== "");

  async function fetchOrders(params) {
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

  // Carga inicial sin filtros
  useEffect(() => {
    fetchOrders({});
  }, []);

  function handleFilterChange(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
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

  const totalAmount = orders.reduce(
    (sum, o) => sum + Number(o.amount ?? o.Amount ?? 0),
    0,
  );
  const paidCount = orders.filter(
    (o) => normalizeStatus(o.status ?? o.Status) === "paid",
  ).length;

  return (
    <div className="page-container history-page">
      {/* Encabezado */}
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

      {/* Panel de filtros */}
      <section className="filter-panel">
        <div className="section-heading">
          <div>
            <p className="section-label">Búsqueda</p>
            <h2>Filtros</h2>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className="primary-action"
              onClick={handleClear}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <form className="filter-form" onSubmit={handleSearch}>
          <div className="filter-group">
            <p className="filter-group-label">Fecha de creación</p>
            <div className="filter-row">
              <div className="field">
                <label htmlFor="fechaDesde">Desde</label>
                <input
                  id="fechaDesde"
                  type="date"
                  value={filters.fechaDesde}
                  onChange={(e) =>
                    handleFilterChange("fechaDesde", e.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="fechaHasta">Hasta</label>
                <input
                  id="fechaHasta"
                  type="date"
                  value={filters.fechaHasta}
                  onChange={(e) =>
                    handleFilterChange("fechaHasta", e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          <div className="filter-group">
            <p className="filter-group-label">Estado</p>
            <div className="field">
              <label htmlFor="estado">Estado de la orden</label>
              <select
                id="estado"
                value={filters.estado}
                onChange={(e) => handleFilterChange("estado", e.target.value)}
                className="filter-select"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-group">
            <p className="filter-group-label">Monto (₡)</p>
            <div className="filter-row">
              <div className="field">
                <label htmlFor="montoMin">Mínimo</label>
                <input
                  id="montoMin"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={filters.montoMin}
                  onChange={(e) =>
                    handleFilterChange("montoMin", e.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="montoMax">Máximo</label>
                <input
                  id="montoMax"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Sin límite"
                  value={filters.montoMax}
                  onChange={(e) =>
                    handleFilterChange("montoMax", e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          <div className="filter-actions">
            <button type="submit" className="primary-action">
              Buscar
            </button>
          </div>
        </form>
      </section>

      {/* Tabla de resultados */}
      <section className="orders-section">
        <div className="section-heading">
          <div>
            <p className="section-label">Resultados</p>
            <h2>
              {isLoading
                ? "Cargando..."
                : `${orders.length} orden${orders.length !== 1 ? "es" : ""} encontrada${orders.length !== 1 ? "s" : ""}`}
            </h2>
          </div>
        </div>

        {error ? (
          <div className="empty-state" role="alert">
            <p>{error}</p>
            <span>Verificá la conexión con el servidor.</span>
          </div>
        ) : isLoading ? (
          <div className="empty-state">
            <p>Cargando historial de pagos...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron órdenes.</p>
            <span>
              {hasActiveFilters
                ? "Intentá con otros filtros."
                : "Aún no hay órdenes registradas."}
            </span>
          </div>
        ) : (
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
              </thead>
              <tbody>
                {orders.map((order) => {
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
                          <span
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            Sin descripción
                          </span>
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
