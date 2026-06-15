import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5081/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export async function createOrder(request) {
  const { data } = await api.post("/orders/", request);
  return data;
}

export async function getOrders() {
  const { data } = await api.get("/orders/");
  return data;
}
export async function getOrdersFiltered({
  fechaDesde,
  fechaHasta,
  estado,
  montoMin,
  montoMax,
} = {}) {
  const params = {};
  if (fechaDesde) params.fechaDesde = fechaDesde;
  if (fechaHasta) params.fechaHasta = fechaHasta;
  if (estado) params.estado = estado;
  if (montoMin !== "" && montoMin != null) params.montoMin = montoMin;
  if (montoMax !== "" && montoMax != null) params.montoMax = montoMax;

  const { data } = await api.get("/orders/", { params });
  return data;
}
export async function getOrderById(id) {
  const { data } = await api.get(`/orders/${id}`);
  return data;
}

export async function expireOrder(id) {
  const { data } = await api.patch(`/orders/${id}/expire`);
  return data;
}

export async function getUnmatchedPayments() {
  const { data } = await api.get("/payments/unmatched");
  return data;
}

export async function matchPaymentToOrder(idOrderPayment, idOrder) {
  const { data } = await api.post(`/payments/${idOrderPayment}/match`, {
    idOrder,
  });
  return data;
}

export default api;
