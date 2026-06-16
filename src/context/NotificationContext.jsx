import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { startSignalR, stopSignalR } from '../services/signalr'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [isHubConnected, setIsHubConnected] = useState(false)
  const [latestDeviceId, setLatestDeviceId] = useState(null)
  const cleanupTimeoutRef = useRef(null)
  const previousNotificationsRef = useRef([])

  useEffect(() => {
    let isMounted = true

    async function initialize() {
      if (cleanupTimeoutRef.current) {
        window.clearTimeout(cleanupTimeoutRef.current)
        cleanupTimeoutRef.current = null
      }

      console.log('[NotificationContext] initializing SignalR connection')

      try {
        await startSignalR((payload) => {
          if (!isMounted) return
          console.log('[NotificationContext] signalR payload', payload)
          setNotifications(payload)
          if (payload.length > 0) {
            setLatestDeviceId(payload[0].deviceId)
          }

          Swal.fire({
            icon: 'warning',
            title: 'Alerta dispositivo desconectado',
            text: 'Se recibió una notificación de dispositivo caído.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#ef4444',
          })
        })

        if (isMounted) {
          setIsHubConnected(true)
          console.log('[NotificationContext] SignalR connected')
        }
      } catch (error) {
        console.error('[NotificationContext] no se pudo conectar a SignalR', error)
      }
    }

    initialize()

    return () => {
      isMounted = false
      cleanupTimeoutRef.current = window.setTimeout(() => {
        console.log('[NotificationContext] stopping SignalR after cleanup delay')
        stopSignalR()
        cleanupTimeoutRef.current = null
      }, 250)
    }
  }, [])

  useEffect(() => {
    const previousIds = previousNotificationsRef.current.map((item) => item.deviceId)
    const currentIds = notifications.map((item) => item.deviceId)

    const newNotifications = notifications.filter((item) => !previousIds.includes(item.deviceId))

    if (newNotifications.length > 0) {
      const notification = newNotifications[0]
      Swal.fire({
        icon: 'error',
        title: 'Dispositivo caído',
        html: `
          <p><strong>${notification.name}</strong> ha quedado desconectado.</p>
          <p>${notification.message}</p>
          <p>Última conexión: <strong>${notification.lastSeenAt ?? 'desconocida'}</strong></p>
        `,
        confirmButtonText: 'Ver detalle',
        confirmButtonColor: '#ef4444',
      }).then(() => {
        // nothing here; the banner también permite ver el detalle
      })
    }

    previousNotificationsRef.current = notifications
  }, [notifications])

  const value = useMemo(
    () => ({
      notifications,
      isHubConnected,
      latestDeviceId,
      setNotifications,
      setLatestDeviceId,
    }),
    [notifications, isHubConnected, latestDeviceId],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
