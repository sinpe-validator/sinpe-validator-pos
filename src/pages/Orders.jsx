import { useEffect, useMemo, useState } from 'react'
import { createOrder, getOrders } from '../services/api'

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
  if (expiresAt instanceof Date && expiresAt.getTime() <= Date.now()) {
    return 'expired'
  }

  const normalized = String(status ?? '').toLowerCase()

  if (normalized === 'pending' || normalized === 'pendiente') {
    return 'pending'
  }

  if (normalized === 'expired' || normalized === 'expirado') {
    return 'expired'
  }

  return 'pending'
}

function mapOrderDto(order) {
  const createdAtValue = order.createdAt ?? order.CreatedAt
  const expiresAtValue = order.expiresAt ?? order.ExpiresAt
  const createdAt = createdAtValue ? new Date(createdAtValue) : new Date()
  const expiresAt = expiresAtValue ? new Date(expiresAtValue) : new Date(createdAt.getTime() + 60 * 1000)

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

function mapOrderRequest(amount, description) {
  return {
    amount,
    description: description || null,
  }
}

export default function Orders() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

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

  const expiredOrders = useMemo(
    () => normalizedOrders.filter((order) => order.normalizedStatus === 'expired'),
    [normalizedOrders],
  )

  const pendingCount = useMemo(() => normalizedOrders.filter((order) => order.normalizedStatus === 'pending').length, [normalizedOrders])

  const totalAmount = useMemo(() => orders.reduce((sum, order) => sum + order.amountValue, 0), [orders])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshTick((currentTick) => currentTick + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadOrders() {
      setIsLoading(true)
      setError('')

      try {
        const response = await getOrders()

        if (!isActive) {
          return
        }

        setOrders(Array.isArray(response) ? response.map(mapOrderDto) : [])
      } catch (loadError) {
        if (!isActive) {
          return
        }

        setError('No se pudieron cargar las órdenes desde el backend.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadOrders()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (activeOrder) {
      setIsFormOpen(false)
    }
  }, [activeOrder])

  const openGenerator = () => {
    if (activeOrder) {
      return
    }

    setAmount('')
    setDescription('')
    setIsFormOpen(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const parsedAmount = Number(amount)

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return
    }

    async function submitOrder() {
      setError('')

      try {
        const response = await createOrder(mapOrderRequest(parsedAmount, description.trim()))
        const createdOrder = mapOrderDto(response)

        setOrders((currentOrders) => [createdOrder, ...currentOrders])
        setAmount('')
        setDescription('')
        setIsFormOpen(false)
      } catch (submitError) {
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
        ) : expiredOrders.length > 0 ? (
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
                {expiredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatCurrency(order.amountValue)}</td>
                    <td>
                      <span className="status-pill status-pill--expired">expirado</span>
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
            <p>Aún no hay órdenes expiradas.</p>
          </div>
        )}
      </section>
    </div>
  )
}