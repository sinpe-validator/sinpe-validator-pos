import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'

const API_URL = 'http://localhost:5081/api/orders'

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(amount ?? 0)
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'

  return new Intl.DateTimeFormat('es-CR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function ManualReview() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState(null)

  async function loadOrdersUnderReview() {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/under-review`)

      if (!response.ok) {
        throw new Error('No se pudieron cargar las órdenes en revisión.')
      }

      const data = await response.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch {
      setError('No se pudieron cargar las órdenes en revisión desde el backend.')
    } finally {
      setIsLoading(false)
    }
  }

  async function acceptPayment(order) {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Aceptar pago',
      html: `
        <p>¿Seguro que desea aceptar manualmente la orden <strong>#${order.orderCode}</strong>?</p>
        <p>Monto: <strong>${formatCurrency(order.orderAmount)}</strong></p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Aceptar pago',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4caf50',
      cancelButtonColor: '#6b7280',
    })

    if (!result.isConfirmed) return

    try {
      setProcessingId(order.idOrder)

      const response = await fetch(`${API_URL}/${order.idOrder}/accept-payment`, {
        method: 'POST',
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'No se pudo aceptar el pago.')
      }

      await Swal.fire({
        icon: 'success',
        title: 'Pago aceptado',
        html: `
          <p>La orden <strong>#${order.orderCode}</strong> fue marcada como pagada.</p>
          <p>Monto: <strong>${formatCurrency(order.orderAmount)}</strong></p>
        `,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4caf50',
      })

      await loadOrdersUnderReview()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al aceptar',
        text: error.message,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#ef4444',
      })
    } finally {
      setProcessingId(null)
    }
  }

  async function rejectPayment(order) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Rechazar pago',
      html: `
        <p>Indique la razón por la que se rechaza la orden <strong>#${order.orderCode}</strong>.</p>
      `,
      input: 'textarea',
      inputPlaceholder: 'Ejemplo: No se reconoce el remitente del pago.',
      inputAttributes: {
        'aria-label': 'Razón del rechazo',
      },
      showCancelButton: true,
      confirmButtonText: 'Rechazar pago',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (!value || value.trim() === '') {
          return 'Debe indicar una razón de rechazo.'
        }

        return null
      },
    })

    if (!result.isConfirmed) return

    try {
      setProcessingId(order.idOrder)

      const response = await fetch(`${API_URL}/${order.idOrder}/reject-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: result.value.trim(),
        }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'No se pudo rechazar el pago.')
      }

      await Swal.fire({
        icon: 'success',
        title: 'Pago rechazado',
        html: `
          <p>La orden <strong>#${order.orderCode}</strong> fue rechazada manualmente.</p>
          <p>Razón: <strong>${result.value.trim()}</strong></p>
        `,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4caf50',
      })

      await loadOrdersUnderReview()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al rechazar',
        text: error.message,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#ef4444',
      })
    } finally {
      setProcessingId(null)
    }
  }

  useEffect(() => {
    loadOrdersUnderReview()
  }, [])

  return (
    <div className="page-container orders-page">
      <div className="page-header">
        <div>
          <h1>Revisión manual de pagos</h1>
          <p>Órdenes que requieren aprobación o rechazo manual.</p>
        </div>

        <div className="summary-cards" aria-label="Resumen de revisión manual">
          <article className="summary-card">
            <span>En revisión</span>
            <strong>{orders.length}</strong>
          </article>
        </div>
      </div>

      {error ? (
        <div className="empty-state" role="alert">
          <p>{error}</p>
          <span>Error al cargar las órdenes</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="empty-state">
          <p>Cargando órdenes en revisión...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <p>No hay pagos en revisión manual</p>
          <span>Actualmente no existen órdenes pendientes de revisión.</span>
        </div>
      ) : (
        <section className="orders-section">
          <div className="section-heading">
            <div>
              <p className="section-label">Pagos sospechosos</p>
              <h2>Órdenes pendientes de revisión</h2>
            </div>
          </div>

          <div className="active-order-card" aria-live="polite">
            {orders.map((order) => (
              <article key={order.idOrderPayment} className="active-order-mini-card active-order-mini-card--wide">
                <div className="active-order-card__code">
                  <p className="section-label">Orden en revisión</p>
                  <strong className="active-order-code mono">{order.orderCode}</strong>
                  <span className="active-order-status status-pill status-pill--underreview">
                    en revisión
                  </span>
                </div>

                <div className="active-order-card__meta">
                  <article className="active-order-mini-card">
                    <span>Monto esperado</span>
                    <strong>{formatCurrency(order.orderAmount)}</strong>
                  </article>

                  <article className="active-order-mini-card">
                    <span>Monto recibido</span>
                    <strong>{formatCurrency(order.smsAmount)}</strong>
                  </article>

                  <article className="active-order-mini-card active-order-mini-card--wide">
                    <span>Remitente</span>
                    <strong>{order.senderName || 'Sin remitente'}</strong>
                  </article>

                  <article className="active-order-mini-card">
                    <span>Referencia SINPE</span>
                    <strong className="mono">{order.sinpeReference || 'Sin referencia'}</strong>
                  </article>

                  <article className="active-order-mini-card">
                    <span>Descripción SMS</span>
                    <strong>{order.smsDescription || 'Sin descripción'}</strong>
                  </article>

                  <article className="active-order-mini-card active-order-mini-card--wide">
                    <span>Motivo de revisión</span>
                    <strong>{order.rejectionReason || 'Sin motivo registrado'}</strong>
                  </article>

                  <article className="active-order-mini-card">
                    <span>Creada</span>
                    <strong>{formatDateTime(order.createdAt)}</strong>
                  </article>

                  <article className="active-order-mini-card">
                    <span>Expira</span>
                    <strong>{formatDateTime(order.orderExpiresAt)}</strong>
                  </article>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="primary-action"
                    disabled={processingId === order.idOrder}
                    onClick={() => acceptPayment(order)}
                  >
                    Aceptar pago
                  </button>

                  <button
                    type="button"
                    className="secondary-action"
                    disabled={processingId === order.idOrder}
                    onClick={() => rejectPayment(order)}
                  >
                    Rechazar pago
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}