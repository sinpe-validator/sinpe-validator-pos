import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'

export default function NotificationBanner() {
  const { notifications, latestDeviceId } = useNotifications()
  const navigate = useNavigate()

  const alertPayload = useMemo(() => {
    if (!notifications || notifications.length === 0) return null

    const total = notifications.length
    const first = notifications[0]
    return {
      count: total,
      title: `${total} dispositivo${total === 1 ? '' : 's'} desconectado${total === 1 ? '' : 's'}`,
      subtitle: first.name,
      message: first.message,
      deviceId: first.deviceId,
    }
  }, [notifications])

  if (!alertPayload) return null

  return (
    <div className="notification-banner" role="alert" aria-live="assertive">
      <div className="notification-banner__icon">⚠️</div>
      <div className="notification-banner__content">
        <strong>{alertPayload.title}</strong>
        <p>{alertPayload.subtitle}</p>
        <p>{alertPayload.message}</p>
      </div>
      <button
        type="button"
        className="notification-banner__action"
        onClick={() => navigate(`/dispositivo/${alertPayload.deviceId}`)}
      >
        Ver detalle
      </button>
    </div>
  )
}
