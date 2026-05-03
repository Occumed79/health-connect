import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API });

export const listProviders = (params) => api.get("/providers", { params }).then((r) => r.data);
export const getProvider = (id) => api.get(`/providers/${id}`).then((r) => r.data);
export const createProvider = (data) => api.post("/providers", data).then((r) => r.data);
export const updateProvider = (id, data) => api.put(`/providers/${id}`, data).then((r) => r.data);
export const deleteProvider = (id) => api.delete(`/providers/${id}`).then((r) => r.data);
export const toggleFavorite = (id) => api.post(`/providers/${id}/favorite`).then((r) => r.data);
export const bulkCreate = (items) => api.post("/providers/bulk", items).then((r) => r.data);
export const getStats = () => api.get("/providers/stats").then((r) => r.data);
export const getBestValue = () => api.get("/providers/best-value").then((r) => r.data);
export const extractFromFile = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/extract", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
export const aiSearch = (query) => api.post("/search/ai", { query }).then((r) => r.data);
export const exportCsvUrl = `${API}/export/csv`;

export const listOutreachThreads = (params) => api.get("/outreach/threads", { params }).then((r) => r.data);
export const createOutreachThread = (data) => api.post("/outreach/threads", data).then((r) => r.data);
export const updateOutreachThread = (id, data) => api.put(`/outreach/threads/${id}`, data).then((r) => r.data);
export const draftOutreachMessage = (data) => api.post("/outreach/draft", data).then((r) => r.data);
export const logOutreachMessage = (data) => api.post("/outreach/messages", data).then((r) => r.data);
export const parseOutreachReply = (data) => api.post("/outreach/replies/parse", data).then((r) => r.data);
export const draftOutreachFollowup = (data) => api.post("/outreach/followup/draft", data).then((r) => r.data);
export const getOutreachConfigStatus = () => api.get("/outreach/config/status").then((r) => r.data);
export const getAutomationSettings = () => api.get("/outreach/automation/settings").then((r) => r.data);
export const updateAutomationSettings = (data) => api.put("/outreach/automation/settings", data).then((r) => r.data);
export const listOutreachQueue = (params) => api.get("/outreach/queue", { params }).then((r) => r.data);
export const queueOutreach = (data) => api.post("/outreach/queue", data).then((r) => r.data);
export const approveOutreachQueueItem = (id, data) => api.post(`/outreach/queue/${id}/approve`, data).then((r) => r.data);
export const sendOutreachQueueItem = (id) => api.post(`/outreach/queue/${id}/send`).then((r) => r.data);
export const sendOutreachNow = (data) => api.post("/outreach/send", data).then((r) => r.data);
export const getThreadMessages = (id) => api.get(`/outreach/threads/${id}/messages`).then((r) => r.data);
export const ingestInboundMessage = (data) => api.post("/outreach/inbound", data).then((r) => r.data);
export const runOutreachAutomationOnce = (limit = 10) => api.post("/outreach/automation/run", null, { params: { limit } }).then((r) => r.data);
