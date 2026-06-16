import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../services'

export default function DeviceDetail() {
  const { deviceId } = useParams()
  const [device, setDevice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDevice() {
      setIsLoading(true)
      setError('')

      try {
        const { data } = await api.get(`/devices/${deviceId}`)
        if (active) setDevice(data)
      } catch {
        if (active) setError('No se pudo cargar el dispositivo.')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    loadDevice()
    return () => {
      active = false
    }
  }, [deviceId])

  return (
    <div className="page-container">
      <div className="page-eyebrow">Dispositivo</div>
      <h1>Detalle del dispositivo</h1>

      {isLoading && <p>Cargando dispositivo...</p>}
      {error && <p className="error-text">{error}</p>}
      {!isLoading && !error && device && (
        <div className="device-detail-card">
          <p><strong>ID:</strong> {deviceId}</p>
          <p><strong>Nombre:</strong> {device.name ?? device.Name}</p>
          <p><strong>Última conexión:</strong> {device.lastSeenAt ?? device.LastSeenAt}</p>
          <p><strong>Estado:</strong> {device.status ?? device.Status ?? 'Desconocido'}</p>
        </div>
      )}
    </div>
  )
}
