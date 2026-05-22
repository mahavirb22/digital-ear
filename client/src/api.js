import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

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

// ML Calibration
export const startMLCalibration = (machineId) =>
  api.post(`/calibrate/${machineId}/start`).then((res) => res.data);
export const addMLCalibrationSample = (machineId, reading) =>
  api.post(`/calibrate/${machineId}/sample`, reading).then((res) => res.data);
export const finalizeMLCalibration = (machineId) =>
  api.post(`/calibrate/${machineId}/finalize`).then((res) => res.data);
export const getMLCalibrationStatus = (machineId) =>
  api.get(`/calibrate/${machineId}/status`).then((res) => res.data);
export const getMLPrediction = (machineId, reading) =>
  api
    .post(`/calibrate/${machineId}/ml-predict`, reading)
    .then((res) => res.data);
export const listAllMLMachines = () =>
  api.get("/calibrate/machines/all").then((res) => res.data);

export default api;
