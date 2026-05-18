import { Link } from 'react-router-dom'
import '../styles/global.css'

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Sistema Punto de Venta
        </Link>
        <ul className="navbar-menu">
          <li><Link to="/" className="nav-link">Órdenes de compra</Link></li>
          <li><Link to="/revision" className="nav-link">Revisión manual</Link></li>
          <li><Link to="/fraude" className="nav-link">Intentos de fraude</Link></li>
          <li><Link to="/historial" className="nav-link">Historial</Link></li>
        </ul>
      </div>
    </nav>
  )
}