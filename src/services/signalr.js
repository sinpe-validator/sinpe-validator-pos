import { HubConnectionBuilder, HttpTransportType, HubConnectionState, LogLevel } from '@microsoft/signalr'

const hubBaseUrl = import.meta.env.VITE_NOTIFICATION_HUB_URL ?? 'http://localhost:5081/hubs/notifications'
const retryDelays = [2000, 5000, 10000, 30000]
let connection = null
let receiveHandler = null
let startPromise = null

function getAccessToken() {
  const tokenFromEnv = import.meta.env.VITE_SIGNALR_ACCESS_TOKEN
  if (tokenFromEnv) return tokenFromEnv
  return window.localStorage.getItem('authToken')
}

function createConnection() {
  const hubUrl = `${hubBaseUrl}?role=pos`
  const token = getAccessToken()
  const options = {
    skipNegotiation: false,
    transport: HttpTransportType.WebSockets,
    withCredentials: false,
  }

  if (token) {
    options.accessTokenFactory = async () => token
  }

  log('Creating SignalR HubConnection', { hubUrl, hasToken: Boolean(token) })

  return new HubConnectionBuilder()
    .withUrl(hubUrl, options)
    .configureLogging(LogLevel.Information)
    .withAutomaticReconnect([0, 2000, 10000, 30000])
    .build()
}

function log(...args) {
  console.log('[SignalR]', ...args)
}

function normalizePayload(payload) {
  if (!Array.isArray(payload)) return []

  return payload.map((item) => ({
    deviceId: item.DeviceId ?? item.deviceId ?? item.id ?? item.DeviceID ?? '',
    name: item.Name ?? item.name ?? 'Dispositivo',
    lastSeenAt: item.LastSeenAt ?? item.lastSeenAt ?? item.lastSeenAtUtc ?? null,
    message: item.Message ?? item.message ?? 'Se perdió la conexión con el dispositivo.',
  }))
}

async function startWithRetry(attempt = 0) {
  if (!connection) connection = createConnection()

  if (connection.state === HubConnectionState.Connected || connection.state === HubConnectionState.Connecting) {
    log('SignalR already connecting or connected', connection.state)
    return
  }

  if (connection.state !== HubConnectionState.Disconnected) {
    log('SignalR connection not disconnected, stopping before retry', connection.state)
    try {
      await connection.stop()
    } catch (stopError) {
      log('Error stopping SignalR before retry', stopError)
    }
    connection = createConnection()
  }

  try {
    startPromise = connection.start()
    await startPromise
    log('Connected to notification hub')
  } catch (error) {
    startPromise = null
    const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)]
    log(`SignalR start failed, retrying in ${delay}ms`, error)
    await new Promise((resolve) => setTimeout(resolve, delay))
    return startWithRetry(attempt + 1)
  }
}

export async function startSignalR(onReceiveNotification) {
  if (!connection) {
    connection = createConnection()
  }

  if (receiveHandler) {
    connection.off('ReceiveNotification', receiveHandler)
  }

  receiveHandler = (payload) => {
    const normalized = normalizePayload(payload)
    log('ReceiveNotification payload received', normalized)
    onReceiveNotification(normalized)
  }

  connection.on('ReceiveNotification', receiveHandler)

  connection.onreconnecting((error) => {
    log('Reconnecting to notification hub', error)
  })

  connection.onreconnected((connectionId) => {
    log('Reconnected with connection ID', connectionId)
  })

  connection.onclose((error) => {
    log('Connection closed', error)
  })

  log('Starting SignalR connection')
  if (startPromise) {
    log('SignalR start already in progress, waiting')
    await startPromise
  } else {
    await startWithRetry(0)
  }
}

export async function stopSignalR() {
  if (!connection) return

  try {
    await connection.stop()
    log('SignalR connection stopped')
  } catch (error) {
    log('Error stopping SignalR connection', error)
  }

  connection = null
  receiveHandler = null
  startPromise = null
}
