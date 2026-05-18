import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5081/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

export async function createOrder(request) {
  const { data } = await api.post('/orders/', request)
  return data
}

export async function getOrders() {
  const { data } = await api.get('/orders/')
  return data
}

export default api