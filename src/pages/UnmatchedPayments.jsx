import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { getUnmatchedPayments, getOrders, matchPaymentToOrder } from '../services/api'

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

// Estados de orden que aún pueden recibir un pago (están "en espera"):
// 1=Pendiente, 3=Expirada, 4=En revisión. Se excluye 2=Pagada.
function isWaitingOrder(order) {
  const status = String(order.status ?? order.Status ?? '')
    .toLowerCase()
    .trim()

  return (
    status === '1' ||
    status === 'pending' ||
    status === '3' ||
    status === 'expired' ||
    status === '4' ||
    status === 'underreview' ||
    status === 'under_review'
  )
}

const STATUS_LABELS = {
  pending: 'Pendiente',
  expired: 'Expirada',
  underreview: 'En revisión',
}

function statusLabel(order) {
  const status = String(order.status ?? order.Status ?? '')
    .toLowerCase()
    .trim()
  if (status === '1' || status === 'pending') return STATUS_LABELS.pending
  if (status === '3' || status === 'expired') return STATUS_LABELS.expired
  if (status === '4' || status === 'underreview' || status === 'under_review')
    return STATUS_LABELS.underreview
  return order.status ?? order.Status ?? ''
}

const POLLING_INTERVAL_MS = 5000

export default function UnmatchedPayments() {
  const [payments, setPayments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState(null)

  // IDs ya conocidos para detectar pagos nuevos en el polling
  const knownIdsRef = useRef(null)

  async function loadUnmatchedPayments() {
    setIsLoading(true)
    setError('')

    try {
      const data = await getUnmatchedPayments()
      const list = Array.isArray(data) ? data : []
      setPayments(list)

      // Inicializamos los IDs conocidos en la primera carga
      if (knownIdsRef.current === null) {
        knownIdsRef.current = new Set(list.map((p) => p.idOrderPayment))
      }
    } catch {
      setError('No se pudieron cargar los pagos sin orden desde el backend.')
    } finally {
      setIsLoading(false)
    }
  }

  async function associatePayment(payment) {
    let waitingOrders

    try {
      const orders = await getOrders()
      waitingOrders = (Array.isArray(orders) ? orders : []).filter(isWaitingOrder)
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las órdenes en espera.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#ef4444',
      })
      return
    }

    if (waitingOrders.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin órdenes en espera',
        text: 'No hay órdenes en espera a las que asociar este pago.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#185fa5',
      })
      return
    }

    const inputOptions = waitingOrders.reduce((options, order) => {
      const id = order.idOrder ?? order.IdOrder
      const code = order.orderCode ?? order.OrderCode ?? `Orden ${id}`
      const amount = formatCurrency(order.amount ?? order.Amount)
      options[id] = `${code} — ${amount} (${statusLabel(order)})`
      return options
    }, {})

    const result = await Swal.fire({
      icon: 'question',
      title: 'Asociar pago a una orden',
      html: `
        <p>Pago de <strong>${formatCurrency(payment.amount)}</strong> de
        <strong>${payment.senderName || 'remitente desconocido'}</strong></p>
        <p>Referencia SINPE: <strong>${payment.sinpeReference || 'Sin referencia'}</strong></p>
      `,
      input: 'select',
      inputOptions,
      inputPlaceholder: 'Seleccione una orden en espera',
      showCancelButton: true,
      confirmButtonText: 'Asociar pago',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4caf50',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (!value) {
          return 'Debe seleccionar una orden.'
        }
        return null
      },
    })

    if (!result.isConfirmed) return

    try {
      setProcessingId(payment.idOrderPayment)

      const response = await matchPaymentToOrder(
        payment.idOrderPayment,
        Number(result.value),
      )

      await Swal.fire({
        icon: 'success',
        title: 'Pago asociado',
        html: `
          <p>El pago fue asociado a la orden <strong>#${response.orderCode ?? response.idOrder}</strong>.</p>
          <p>La orden quedó marcada como pagada.</p>
        `,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4caf50',
      })

      await loadUnmatchedPayments()
    } catch (error) {
      const message =
        error?.response?.data ||
        error?.message ||
        'No se pudo asociar el pago a la orden.'

      Swal.fire({
        icon: 'error',
        title: 'Error al asociar',
        text: typeof message === 'string' ? message : 'No se pudo asociar el pago.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#ef4444',
      })
    } finally {
      setProcessingId(null)
    }
  }

  useEffect(() => {
    loadUnmatchedPayments()
  }, [])

  // ─── Polling: notificar cuando llegan nuevos pagos sin orden ─────────────
  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      // Esperamos a que la carga inicial haya inicializado los IDs conocidos
      if (knownIdsRef.current === null) return

      try {
        const data = await getUnmatchedPayments()
        const list = Array.isArray(data) ? data : []

        const newPayments = list.filter(
          (p) => !knownIdsRef.current.has(p.idOrderPayment)
        )

        if (newPayments.length === 0) return

        // Actualizamos IDs conocidos y la lista en pantalla
        newPayments.forEach((p) => knownIdsRef.current.add(p.idOrderPayment))
        setPayments(list)

        // Notificamos uno por uno
        for (const payment of newPayments) {
          await Swal.fire({
            icon: 'warning',
            title: 'Pago sin orden recibido',
            html: `
              <p>Se recibió un pago que no corresponde a ninguna orden.</p>
              <p>Monto: <strong>${formatCurrency(payment.amount)}</strong></p>
              <p>Remitente: <strong>${payment.senderName || 'Desconocido'}</strong></p>
              <p>Referencia: <strong>${payment.sinpeReference || 'Sin referencia'}</strong></p>
            `,
            confirmButtonText: 'Ver pagos',
            confirmButtonColor: '#f59e0b',
          })
        }
      } catch {
        // Silenciamos errores de red en el polling
        console.warn('Error en el polling de pagos sin orden')
      }
    }, POLLING_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="page-container orders-page">
      <div className="page-header">
        <div>
          <h1>Pagos sin orden</h1>
          <p>Pagos recibidos por SMS para los que no se encontró una orden asociada.</p>
        </div>

        <div className="summary-cards" aria-label="Resumen de pagos sin orden">
          <article className="summary-card">
            <span>Sin asociar</span>
            <strong>{payments.length}</strong>
          </article>
        </div>
      </div>

      {error ? (
        <div className="empty-state" role="alert">
          <p>{error}</p>
          <span>Error al cargar los pagos</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="empty-state">
          <p>Cargando pagos sin orden...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="empty-state">
          <p>No hay pagos sin orden</p>
          <span>Todos los pagos recibidos están asociados a una orden.</span>
        </div>
      ) : (
        <section className="orders-section">
          <div className="section-heading">
            <div>
              <p className="section-label">Pagos recibidos por SMS</p>
              <h2>Pagos pendientes de asociar</h2>
            </div>
          </div>

          <div className="active-order-card" aria-live="polite">
            {payments.map((payment) => (
              <article
                key={payment.idOrderPayment}
                className="active-order-mini-card active-order-mini-card--wide"
              >
                <div className="active-order-card__code">
                  <p className="section-label">Pago sin orden</p>
                  <strong className="active-order-code mono">
                    {payment.sinpeReference || 'Sin referencia'}
                  </strong>
                  <span className="active-order-status status-pill status-pill--unmatched">
                    sin orden
                  </span>
                </div>

                <div className="active-order-card__meta">
                  <article className="active-order-mini-card">
                    <span>Monto recibido</span>
                    <strong>{formatCurrency(payment.amount)}</strong>
                  </article>

                  <article className="active-order-mini-card active-order-mini-card--wide">
                    <span>Remitente</span>
                    <strong>{payment.senderName || 'Sin remitente'}</strong>
                  </article>

                  <article className="active-order-mini-card">
                    <span>Referencia SINPE</span>
                    <strong className="mono">{payment.sinpeReference || 'Sin referencia'}</strong>
                  </article>

                  <article className="active-order-mini-card active-order-mini-card--wide">
                    <span>Descripción SMS</span>
                    <strong>{payment.smsDescription || 'Sin descripción'}</strong>
                  </article>

                  <article className="active-order-mini-card active-order-mini-card--wide">
                    <span>Motivo</span>
                    <strong>{payment.rejectionReason || 'No se encontró una orden asociada'}</strong>
                  </article>

                  <article className="active-order-mini-card">
                    <span>Recibido</span>
                    <strong>{formatDateTime(payment.receivedAt)}</strong>
                  </article>

                  <article className="active-order-mini-card">
                    <span>Procesado</span>
                    <strong>{formatDateTime(payment.processedAt)}</strong>
                  </article>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="primary-action"
                    disabled={processingId === payment.idOrderPayment}
                    onClick={() => associatePayment(payment)}
                  >
                    Asociar a una orden
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