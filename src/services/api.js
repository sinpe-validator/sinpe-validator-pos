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
export async function getOrderById(id) {
  const { data } = await api.get(`/orders/${id}`)
  return data
}

export async function expireOrder(id) {
  const { data } = await api.patch(`/orders/${id}/expire`)
  return data
}

export default api