import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

export const fetchDevices = () =>
  api.get("/data/active-devices").then((res) => res.data);
export const fetchSensorData = (deviceId) =>
  api.get(`/data/${deviceId}`).then((res) => res.data);
export const fetchNotifications = (deviceId) =>
  api
    .get(deviceId ? `/notifications/${deviceId}` : "/notifications")
    .then((res) => res.data);
export const acknowledgeNotification = (id) =>
  api.patch(`/notifications/${id}/acknowledge`).then((res) => res.data);
export const subscribeToPush = (subscription) =>
  api.post("/subscribe", subscription).then((res) => res.data);

// Device management
export const registerDevice = (deviceId, name) =>
  api.post("/devices/register", { deviceId, name }).then((res) => res.data);
export const removeDevice = (deviceId) =>
  api.delete(`/devices/${deviceId}`).then((res) => res.data);
export const fetchRegisteredDevices = () =>
  api.get("/devices").then((res) => res.data);
export const checkStoppages = () =>
  api.get("/devices/stoppages").then((res) => res.data);

// Machine calibration
export const fetchMachines = () => api.get("/machines").then((res) => res.data);
export const createMachine = (name) =>
  api.post("/machines", { name }).then((res) => res.data);
export const startCalibration = (machineId, deviceId, durationSeconds) =>
  api
    .post(`/machines/${machineId}/calibrate`, { deviceId, durationSeconds })
    .then((res) => res.data);
export const markMaintenanceComplete = (machineId) =>
  api
    .patch(`/machines/${machineId}/maintenance-complete`)
    .then((res) => res.data);
export const turnOffMachine = (machineId) =>
  api.patch(`/machines/${machineId}/turn-off`).then((res) => res.data);
export const turnOnMachine = (machineId) =>
  api.patch(`/machines/${machineId}/turn-on`).then((res) => res.data);

export default api;
