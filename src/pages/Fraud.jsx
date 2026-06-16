import { useEffect, useMemo, useState } from "react";
import { getFraudAttempts } from "../services/api";

function formatDateTime(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const INCONSISTENCY_LABELS = {
  AmountMismatch: "Monto incorrecto",
  DuplicateReference: "Referencia duplicada",
  InvalidOrderCode: "Código inválido",
  ExpiredOrder: "Orden expirada",
  DateMismatch: "Fecha incorrecta",
  PossibleFraud: "Posible intento de fraude",
  InvalidPaymentData: "Datos de pago inválidos",
};

const INCONSISTENCY_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "AmountMismatch", label: "Monto incorrecto" },
  { value: "DuplicateReference", label: "Referencia duplicada" },
  { value: "InvalidOrderCode", label: "Código inválido" },
  { value: "ExpiredOrder", label: "Orden expirada" },
  { value: "DateMismatch", label: "Fecha incorrecta" },
  { value: "PossibleFraud", label: "Posible fraude" },
  { value: "InvalidPaymentData", label: "Datos inválidos" },
];

const EMPTY_FILTERS = {
  inconsistencyType: "",
  detail: "",
  idSms: "",
  idPayment: "",
  detectedFrom: "",
  detectedTo: "",
};

function getAttemptId(attempt) {
  return attempt.idAttempt ?? attempt.IdAttempt;
}

function getInconsistencyType(attempt) {
  return attempt.inconsistencyType ?? attempt.InconsistencyType ?? "";
}

function getDetail(attempt) {
  return attempt.detail ?? attempt.Detail ?? "";
}

function getIdSms(attempt) {
  return attempt.idSms ?? attempt.IdSms ?? "";
}

function getIdPayment(attempt) {
  return attempt.idOrderPayment ?? attempt.IdOrderPayment ?? "";
}

function getDetectedAt(attempt) {
  return attempt.detectedAt ?? attempt.DetectedAt;
}

export default function Fraud() {
  const [attempts, setAttempts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const hasActiveFilters = Object.values(appliedFilters).some(
    (value) => value !== "",
  );

  async function loadFraudAttempts() {
    setIsLoading(true);
    setError("");

    try {
      const data = await getFraudAttempts();
      setAttempts(Array.isArray(data) ? data : []);
    } catch {
      setError("No se pudieron cargar los registros de seguridad.");
      setAttempts([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFraudAttempts();
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
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  const filteredAttempts = useMemo(() => {
    return attempts.filter((attempt) => {
      const inconsistencyType = getInconsistencyType(attempt);
      const detail = String(getDetail(attempt)).toLowerCase();
      const idSms = String(getIdSms(attempt));
      const idPayment = String(getIdPayment(attempt));
      const detectedAt = getDetectedAt(attempt);

      if (
        appliedFilters.inconsistencyType &&
        inconsistencyType !== appliedFilters.inconsistencyType
      ) {
        return false;
      }

      if (
        appliedFilters.detail &&
        !detail.includes(appliedFilters.detail.toLowerCase())
      ) {
        return false;
      }

      if (appliedFilters.idSms && !idSms.includes(appliedFilters.idSms)) {
        return false;
      }

      if (
        appliedFilters.idPayment &&
        !idPayment.includes(appliedFilters.idPayment)
      ) {
        return false;
      }

      if (appliedFilters.detectedFrom) {
        if (!detectedAt) return false;

        const detectedDate = new Date(detectedAt);
        const fromDate = new Date(`${appliedFilters.detectedFrom}T00:00:00`);

        if (detectedDate < fromDate) return false;
      }

      if (appliedFilters.detectedTo) {
        if (!detectedAt) return false;

        const detectedDate = new Date(detectedAt);
        const toDate = new Date(`${appliedFilters.detectedTo}T23:59:59`);

        if (detectedDate > toDate) return false;
      }

      return true;
    });
  }, [attempts, appliedFilters]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="section-label">Seguridad</p>
          <h1>Pagos en lista negra</h1>
          <p>Órdenes marcadas como sospechosas por el sistema.</p>
        </div>

        <div className="summary-cards">
          <article className="summary-card">
            <span>Total registros</span>
            <strong>{attempts.length}</strong>
          </article>
        </div>
      </div>

      <section className="orders-section">
        <form onSubmit={handleSearch}>
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>ID SMS</th>
                  <th>ID pago</th>
                  <th>Fecha</th>
                </tr>

                <tr className="table-filter-row table-filter-row--compact">
                  <th>
                    <span className="table-filter-title">Filtros</span>
                  </th>

                  <th>
                    <select
                      value={filters.inconsistencyType}
                      onChange={(event) =>
                        handleFilterChange(
                          "inconsistencyType",
                          event.target.value,
                        )
                      }
                    >
                      {INCONSISTENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </th>

                  <th>
                    <input
                      type="text"
                      placeholder="Buscar detalle"
                      value={filters.detail}
                      onChange={(event) =>
                        handleFilterChange("detail", event.target.value)
                      }
                    />
                  </th>

                  <th>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="SMS"
                      value={filters.idSms}
                      onChange={(event) =>
                        handleFilterChange("idSms", event.target.value)
                      }
                    />
                  </th>

                  <th>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Pago"
                      value={filters.idPayment}
                      onChange={(event) =>
                        handleFilterChange("idPayment", event.target.value)
                      }
                    />
                  </th>

                  <th>
                    <div className="table-filter-date-actions">
                      <div className="table-filter-date-row">
                        <input
                          type="date"
                          value={filters.detectedFrom}
                          onChange={(event) =>
                            handleFilterChange("detectedFrom", event.target.value)
                          }
                        />

                        <input
                          type="date"
                          value={filters.detectedTo}
                          onChange={(event) =>
                            handleFilterChange("detectedTo", event.target.value)
                          }
                        />
                      </div>

                      <div className="table-filter-actions-inline">
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
                        <button
                          type="button"
                          className="primary-action"
                          onClick={loadFraudAttempts}
                          style={{ marginTop: "1rem" }}
                        >
                          Reintentar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <p>Cargando registros de seguridad...</p>
                      </div>
                    </td>
                  </tr>
                ) : attempts.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <p>No hay registros en lista negra.</p>
                        <span>
                          El sistema mostrará aquí los pagos sospechosos.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <p>No se encontraron coincidencias.</p>
                        <span>Probá con otros filtros.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAttempts.map((attempt, index) => {
                    const idAttempt = getAttemptId(attempt);
                    const inconsistencyType = getInconsistencyType(attempt);
                    const detail = getDetail(attempt);
                    const idSms = getIdSms(attempt);
                    const idPayment = getIdPayment(attempt);
                    const detectedAt = getDetectedAt(attempt);

                    return (
                      <tr key={idAttempt ?? index}>
                        <td className="mono">{idAttempt ?? "—"}</td>

                        <td>
                          <span className="status-pill status-pill--underreview">
                            {INCONSISTENCY_LABELS[inconsistencyType] ??
                              inconsistencyType ??
                              "Sin clasificar"}
                          </span>
                        </td>

                        <td>
                          {detail || (
                            <span className="text-muted">Sin detalle</span>
                          )}
                        </td>

                        <td className="mono">{idSms || "—"}</td>
                        <td className="mono">{idPayment || "—"}</td>
                        <td>{formatDateTime(detectedAt)}</td>
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