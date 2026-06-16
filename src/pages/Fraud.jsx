import { useEffect, useState } from 'react'
import { getFraudAttempts } from '../services/api'

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const INCONSISTENCY_LABELS = {
  AmountMismatch: 'Monto incorrecto',
  DuplicateReference: 'Referencia duplicada',
  InvalidOrderCode: 'Código de orden inválido',
  ExpiredOrder: 'Orden expirada',
  DateMismatch: 'Fecha incorrecta',
}

export default function Fraud() {
  const [attempts, setAttempts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadFraudAttempts() {
    setIsLoading(true)
    setError('')
    try {
      const data = await getFraudAttempts()
      setAttempts(Array.isArray(data) ? data : [])
    } catch {
      setError('No se pudieron cargar los intentos de fraude.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFraudAttempts()
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="section-label">Seguridad</p>
          <h1>Pagos lista negra</h1>
          <p>Pagos clasificados como intentos de fraude por el sistema.</p>
        </div>

        <div className="summary-cards">
          <article className="summary-card">
            <span>Intentos detectados</span>
            <strong>{attempts.length}</strong>
          </article>
        </div>
      </div>

      {error ? (
        <div className="empty-state" role="alert">
          <p>{error}</p>
          <button className="primary-action" onClick={loadFraudAttempts} style={{ marginTop: '1rem' }}>
            Reintentar
          </button>
        </div>
      ) : isLoading ? (
        <div className="empty-state">
          <p>Cargando intentos de fraude...</p>
        </div>
      ) : attempts.length === 0 ? (
        <div className="empty-state">
          <p>No se han detectado intentos de fraude</p>
          <span>El sistema registrará aquí los pagos sospechosos automáticamente.</span>
        </div>
      ) : (
        <section className="orders-section">
          <div className="section-heading">
            <div>
              <p className="section-label">Registros</p>
              <h2>{attempts.length} intento{attempts.length !== 1 ? 's' : ''} detectado{attempts.length !== 1 ? 's' : ''}</h2>
            </div>
          </div>

          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo de inconsistencia</th>
                  <th>Detalle</th>
                  <th>ID SMS</th>
                  <th>ID Pago</th>
                  <th>Detectado</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.idAttempt}>
                    <td className="mono">{attempt.idAttempt}</td>
                    <td>
                      <span className="status-pill status-pill--expired">
                        {INCONSISTENCY_LABELS[attempt.inconsistencyType] ?? attempt.inconsistencyType}
                      </span>
                    </td>
                    <td>{attempt.detail ?? <span style={{ color: 'var(--color-text-secondary)' }}>Sin detalle</span>}</td>
                    <td className="mono">{attempt.idSms ?? '—'}</td>
                    <td className="mono">{attempt.idOrderPayment ?? '—'}</td>
                    <td>{formatDateTime(attempt.detectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}