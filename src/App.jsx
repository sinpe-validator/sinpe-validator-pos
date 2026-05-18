import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components'
import { Orders, ManualReview, Fraud, History } from './pages'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Orders />} />
        <Route path="/revision" element={<ManualReview />} />
        <Route path="/fraude" element={<Fraud />} />
        <Route path="/historial" element={<History />} />
      </Routes>
    </BrowserRouter>
  )
}
