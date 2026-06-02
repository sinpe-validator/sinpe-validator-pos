import { useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { createOrder, getOrders, getOrderById, expireOrder } from '../services/api'

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatTime(date) {
  return new Intl.DateTimeFormat('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat('es-CR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function normalizeStatus(status, expiresAt) {
  const normalized = String(status ?? '').toLowerCase().trim()

  // Valores numéricos que envía el backend (1=Pending, 2=Paid, 3=Expired, 4=UnderReview)
  if (normalized === '2' || normalized === 'paid' || normalized === 'pagado') return 'paid'
  if (normalized === '3' || normalized === 'expired' || normalized === 'expirado') return 'expired'
  if (normalized === '4' || normalized === 'underreview' || normalized === 'under_review' || normalized === 'en revisión') return 'underreview'

  // Solo las órdenes pendientes pueden expirar por tiempo
  if (expiresAt instanceof Date && expiresAt.getTime() <= Date.now()) return 'expired'

  return 'pending'
}

function mapOrderDto(order) {
  const createdAtValue = order.createdAt ?? order.CreatedAt
  const expiresAtValue = order.expiresAt ?? order.ExpiresAt
  const createdAt = createdAtValue ? new Date(createdAtValue) : new Date()
  const expiresAt = expiresAtValue ? new Date(expiresAtValue) : new Date(createdAt.getTime() + 5 * 60 * 1000)

  return {
    id: order.idOrder ?? order.IdOrder ?? order.orderCode ?? order.OrderCode ?? crypto.randomUUID(),
    reference: order.orderCode ?? order.OrderCode ?? '',
    amountValue: Number(order.amount ?? order.Amount ?? 0),
    status: normalizeStatus(order.status ?? order.Status, expiresAt),
    description: order.description ?? order.Description ?? '',
    createdAt,
    expiresAt,
  }
}

const STATUS_LABELS = {
  pending: 'pendiente',
  paid: 'pagado',
  expired: 'expirado',
  underreview: 'en revisión',
}

function StatusPill({ status }) {
  return (
    <span className={`status-pill status-pill--${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function mapOrderRequest(amount, description) {
  return {
    amount,
    description: description || null,
  }
}

// Intervalo de polling en milisegundos
const POLLING_INTERVAL_MS = 5000

export default function Orders() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  // Guardamos los IDs que estaban en "pending" en el último poll,
  // para detectar cuáles cambiaron a "paid"
  const pendingIdsRef = useRef(new Set())
  const prevStatusMapRef = useRef({})

  const normalizedOrders = useMemo(
    () =>
      orders.map((order) => ({
        ...order,
        normalizedStatus: normalizeStatus(order.status, order.expiresAt),
      })),
    [orders, refreshTick],
  )

  const activeOrder = useMemo(
    () =>
      normalizedOrders
        .filter((order) => order.normalizedStatus === 'pending')
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null,
    [normalizedOrders],
  )

  const completedOrders = useMemo(
    () => normalizedOrders.filter((order) => order.normalizedStatus !== 'pending'),
    [normalizedOrders],
  )

  const pendingCount = useMemo(() => normalizedOrders.filter((order) => order.normalizedStatus === 'pending').length, [normalizedOrders])

  const totalAmount = useMemo(() => orders.reduce((sum, order) => sum + order.amountValue, 0), [orders])

  // ─── Ticker de 1 segundo para expiración visual ───────────────────────────
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshTick((currentTick) => currentTick + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  // ─── Detectar órdenes que pasan de pending → expired por tiempo ──────────
  useEffect(() => {
    const nowExpired = normalizedOrders.filter((order) => {
      const prev = prevStatusMapRef.current[order.id]
      return prev === 'pending' && order.normalizedStatus === 'expired'
    })

    normalizedOrders.forEach((order) => {
      prevStatusMapRef.current[order.id] = order.normalizedStatus
    })

    if (nowExpired.length === 0) return

    nowExpired.forEach((order) => pendingIdsRef.current.delete(order.id))

    nowExpired.forEach(async (order) => {
      try {
        await expireOrder(order.id)
      } catch {
        console.warn(`No se pudo notificar expiración al backend para la orden ${order.id}`)
      }

      Swal.fire({
        icon: 'warning',
        title: 'Orden expirada',
        html: `
          <p>La orden <strong>#${order.reference}</strong> expiró sin recibir pago.</p>
          <p>Monto: <strong>${formatCurrency(order.amountValue)}</strong></p>
        `,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#ef4444',
      })
    })
  }, [normalizedOrders])

  // ─── Carga inicial de órdenes ─────────────────────────────────────────────
  useEffect(() => {
    let isActive = true

    async function loadOrders() {
      setIsLoading(true)
      setError('')

      try {
        const response = await getOrders()

        if (!isActive) return

        const mapped = Array.isArray(response) ? response.map(mapOrderDto) : []
        setOrders(mapped)

        // Inicializamos el set de pendientes con los IDs actuales
        pendingIdsRef.current = new Set(
          mapped.filter((o) => o.status === 'pending').map((o) => o.id)
        )
      } catch {
        if (!isActive) return
        setError('No se pudieron cargar las órdenes desde el backend.')
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    loadOrders()

    return () => { isActive = false }
  }, [])

  // ─── Polling: detectar órdenes que pasaron de pending → paid ─────────────
  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      // Si no hay pendientes, no hacemos nada
      if (pendingIdsRef.current.size === 0) return

      try {
        for (const id of pendingIdsRef.current) {
          const order = mapOrderDto(await getOrderById(id))

          if (order.status === 'paid') {
            pendingIdsRef.current.delete(id)

            setOrders((current) =>
              current.map((o) => (o.id === id ? order : o))
            )

            await Swal.fire({
              icon: 'success',
              title: '¡Pago recibido!',
              html: `
                <p>La orden <strong>#${order.reference}</strong> fue pagada exitosamente.</p>
                <p>Monto: <strong>${formatCurrency(order.amountValue)}</strong></p>
              `,
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#4caf50',
            })
          } else if (order.status === 'expired') {
            pendingIdsRef.current.delete(id)

            setOrders((current) =>
              current.map((o) => (o.id === id ? order : o))
            )
          }
        }
      } catch {
        // Silenciamos errores de red en el polling para no molestar al usuario
        console.warn('Error en el polling de órdenes')
      }
    }, POLLING_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (activeOrder) {
      setIsFormOpen(false)
    }
  }, [activeOrder])

  const openGenerator = () => {
    if (activeOrder) return
    setAmount('')
    setDescription('')
    setIsFormOpen(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const parsedAmount = Number(amount)

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return

    async function submitOrder() {
      setError('')

      try {
        const response = await createOrder(mapOrderRequest(parsedAmount, description.trim()))
        const createdOrder = mapOrderDto(response)

        setOrders((currentOrders) => [createdOrder, ...currentOrders])

        // Registramos la nueva orden como pendiente en el ref
        pendingIdsRef.current.add(createdOrder.id)

        setAmount('')
        setDescription('')
        setIsFormOpen(false)
      } catch {
        setError('No se pudo crear la orden en el backend.')
      }
    }

    submitOrder()
  }

  return (
    <div className="page-container orders-page">
      <div className="page-header">
        <div>
          <h1>Órdenes de compra</h1>
          <p>Genera nuevas órdenes de compra</p>
        </div>

        <div className="summary-cards" aria-label="Resumen de órdenes">
          <article className="summary-card">
            <span>Órdenes creadas</span>
            <strong>{orders.length}</strong>
          </article>
          <article className="summary-card">
            <span>Pendientes</span>
            <strong>{pendingCount}</strong>
          </article>
          <article className="summary-card">
            <span>Monto total</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </article>
        </div>
      </div>

      <section className="generator-panel">
        <div className="generator-panel__content">
          <div>
            <p className="section-label">Nueva orden</p>
            <h2>Generador de orden de compra</h2>
          </div>

          <button type="button" className="primary-action" onClick={openGenerator} disabled={Boolean(activeOrder)}>
            Generar orden de compra
          </button>
        </div>

        {activeOrder ? (
          <div className="active-order-card" aria-live="polite">
            <div className="active-order-card__code">
              <p className="section-label">Código de orden para SINPE</p>
              <strong className="active-order-code mono">{activeOrder.reference}</strong>
              <span className="active-order-status status-pill status-pill--pending">pendiente</span>
            </div>

            <div className="active-order-card__meta">
              <article className="active-order-mini-card">
                <span>Monto</span>
                <strong>{formatCurrency(activeOrder.amountValue)}</strong>
              </article>

              <article className="active-order-mini-card active-order-mini-card--wide">
                <span>Descripción</span>
                <strong>{activeOrder.description || 'Sin descripción'}</strong>
              </article>

              <article className="active-order-mini-card">
                <span>Creada</span>
                <strong>{formatDateTime(activeOrder.createdAt)}</strong>
                <small>{formatTime(activeOrder.createdAt)}</small>
              </article>

              <article className="active-order-mini-card">
                <span>Expira</span>
                <strong>{formatDateTime(activeOrder.expiresAt)}</strong>
                <small>{formatTime(activeOrder.expiresAt)}</small>
              </article>
            </div>
          </div>
        ) : isFormOpen ? (
          <form className="order-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="amount">Monto</label>
              <input
                id="amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Ingrese el monto"
              />
            </div>

            <div className="field field--wide">
              <label htmlFor="description">Descripción opcional</label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Agrega una descripción si lo necesitas"
              />
            </div>

            <button type="submit" className="secondary-action">
              Generar orden
            </button>
          </form>
        ) : null}
      </section>

      {error ? (
        <div className="empty-state" role="alert">
          <p>{error}</p>
          <span>Error al cargar las órdenes</span>
        </div>
      ) : null}

      <section className="orders-section">
        <div className="section-heading">
          <div>
            <p className="section-label">Órdenes completadas y expiradas</p>
            <h2>Tabla de órdenes</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state">
            <p>Cargando órdenes...</p>
          </div>
        ) : completedOrders.length > 0 ? (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Referencia</th>
                  <th>Descripción</th>
                  <th>Creado</th>
                  <th>Expira</th>
                </tr>
              </thead>
              <tbody>
                {completedOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatCurrency(order.amountValue)}</td>
                    <td>
                      <StatusPill status={order.normalizedStatus} />
                    </td>
                    <td className="mono">{order.reference}</td>
                    <td>{order.description || 'Sin descripción'}</td>
                    <td>
                      <div className="timestamp-cell">
                        <span>{formatDateTime(order.createdAt)}</span>
                        <span>{formatTime(order.createdAt)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="timestamp-cell">
                        <span>{formatDateTime(order.expiresAt)}</span>
                        <span>{formatTime(order.expiresAt)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>Aún no hay órdenes completadas o expiradas.</p>
          </div>
        )}
      </section>
    </div>
  )
}