import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components'
import { Orders, ManualReview, UnmatchedPayments, Fraud, History, DeviceDetail } from './pages'
import NotificationBanner from './components/NotificationBanner'
import { NotificationProvider } from './context/NotificationContext'
import './App.css'

export default function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <Navbar />
        <NotificationBanner />
        <Routes>
          <Route path="/" element={<Orders />} />
          <Route path="/revision" element={<ManualReview />} />
          <Route path="/pagos-sin-orden" element={<UnmatchedPayments />} />
          <Route path="/fraude" element={<Fraud />} />
          <Route path="/historial" element={<History />} />
          <Route path="/dispositivo/:deviceId" element={<DeviceDetail />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  )
}
