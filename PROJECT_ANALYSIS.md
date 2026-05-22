# Digital Ear — Complete Project Documentation

**A Full-Stack IoT Predictive Maintenance System for Industrial Motors**

---

## Table of Contents
1. [Project Purpose](#project-purpose)
2. [Architecture Overview](#architecture-overview)
3. [Key Features Implemented](#key-features-implemented)
4. [Database & Data Models](#database--data-models)
5. [Authentication System](#authentication-system)
6. [Hardware Integration](#hardware-integration)
7. [ML/AI Components](#mlai-components)
8. [API Endpoints](#api-endpoints)
9. [Frontend Pages & Components](#frontend-pages--components)
10. [External Services & Integrations](#external-services--integrations)
11. [Data Flow Diagram](#data-flow-diagram)
12. [Technology Stack](#technology-stack)

---

## Project Purpose

**Digital Ear** is an **IoT-based predictive maintenance system** designed to monitor industrial motors and rotating machinery in real-time. Using acoustic sensors (digital microphones) and electrical current monitoring, it detects anomalies—vibrations, frequency shifts, current spikes—before failures occur, enabling preventive maintenance and reducing unplanned downtime.

**Core Value:**
- Predict machine failures before they happen
- Reduce maintenance costs by 30–50%
- Monitor equipment 24/7 without human intervention
- Instant alerts when critical thresholds are breached

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────┐
│         FRONTEND (React + Vite + Tailwind)              │
│  - Dashboard with real-time device metrics              │
│  - 3D Motor Twin (Three.js visualization)               │
│  - Device detail pages with sensor graphs               │
│  - Authentication & OTP password reset                  │
│  - Notifications center                                 │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (JSON)
┌──────────────────────▼──────────────────────────────────┐
│     BACKEND (Node.js + Express)                         │
│  - User management & JWT auth                           │
│  - Device registration & status tracking                │
│  - Real-time anomaly detection coordination             │
│  - WebPush notification dispatcher                      │
│  - Calibration engine                                   │
└──────────────────────┬──────────────────────────────────┘
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼──┐   ┌─────▼────┐  ┌────▼────┐
    │MongoDB │   │Python ML │  │WebPush  │
    │        │   │Service   │  │Service  │
    │(Data)  │   │(Anomaly  │  │(VAPID)  │
    │        │   │Detection)│  │         │
    └────────┘   └──────────┘  └─────────┘
         │
    ┌────▼───────────────────────────────────┐
    │  HARDWARE (ESP32 + Sensors)             │
    │  - INMP441 Audio Microphone (I2S)       │
    │  - ADC Current Sensing (Power Monitor)  │
    │  - GPIO Vibration Detector              │
    │  - WiFi + Offline Buffering             │
    └─────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|-----------------|
| **Frontend** | User dashboard, 3D visualization, real-time metrics, authentication UI |
| **Backend** | API orchestration, business logic, ML coordination, notifications |
| **Database** | Persistent storage of users, devices, machines, sensor readings, alerts |
| **ML Service** | Anomaly detection using Isolation Forest + One-Class SVM |
| **Hardware** | Continuous sensor collection with offline resilience |

---

## Key Features Implemented

### 1. Frontend (React/Vite/Tailwind)

#### **Dashboard**
- **Hero Stats:** Active devices count, machine count, anomalies detected today
- **Machine Grid:** Status cards for each registered machine (running/offline/anomaly)
- **Device List:** Inline device metrics with last seen timestamp
- **Real-time Updates:** Polling every 2–5 seconds via `setInterval`

#### **3D Motor Twin (MotorViewer)**
- **Three.js Visualization:** Interactive 3D motor model
- **Real-time Indicators:** Health score, temperature gauge, vibration level
- **Dynamic Animation:** Motor rotation speed tied to sensor frequency readings
- **Status Panel:** Machine state, thresholds, alert history
- **React Three Fiber:** Canvas-based rendering with OrbitControls

#### **Device Detail Page**
- **Multi-metric Graphs:** Recharts line charts for:
  - Sound energy trend
  - Frequency domain analysis
  - Current consumption over time
  - Anomaly timeline with severity markers
- **Real-time Values:** Latest readings with timestamps

#### **Authentication Pages**
- **Login:** Email + password with session persistence
- **Signup:** New account creation with form validation
- **Forgot Password → OTP Verification → Reset Password:** 3-step recovery flow
- **Auth Context:** Global JWT token management with localStorage fallback

#### **Notifications Center**
- List all anomaly alerts with severity levels (warning/critical)
- Filter by device or time range
- Mark alerts as acknowledged
- Real-time toast notifications on critical events

#### **Device Connection/Setup**
- **ConnectDevice Page:** Step-by-step WiFi pairing wizard for new ESP32 devices
- Visual instructions for device registration

#### **Component Library**
| Component | Purpose |
|-----------|---------|
| `MotorModel` | 3D parametric motor mesh (cylinder + rotor) |
| `MotorViewer` | React Three Fiber canvas with camera & lighting |
| `SensorStats` | 4-stat inline card (RPM, temp, vibration, current) |
| `StatusPanel` | Side panel showing machine state & thresholds |
| `MachineCard` | Grid card with calibration button & status |
| `DeviceCard` | Inline device item with metrics |
| `DashboardCard` | Hero stat card with trend indicator |
| `CalibrationModal` | Modal for starting baseline collection |
| `Header` | Top navigation bar with user menu |
| `Sidebar` | Left navigation menu |
| `Layout` | Wrapper providing Sidebar + Header |

#### **Styling**
- **Tailwind CSS v4** with custom design tokens
- **Dark theme** with primary blue accent (#adc6ff)
- **Responsive grids** for dashboard & device lists
- **Custom animations** in motor.css (spin, pulse, glow effects)

---

### 2. Backend (Node.js + Express)

#### **User Management**
- **Signup:** POST `/api/auth/signup`
  - Creates User document
  - Hashes password with bcrypt (10 salt rounds)
  - Returns JWT token (7-day expiry)
- **Login:** POST `/api/auth/login`
  - Validates credentials
  - Issues JWT token
- **Password Recovery:**
  - `POST /api/auth/forgot-password` → Sends 6-digit OTP via Resend email (15-min validity)
  - `POST /api/auth/verify-otp` → Validates OTP
  - `POST /api/auth/reset-password` → Sets new hashed password

#### **Device Management**
- **Registration:** POST `/api/devices/register`
  - Generates unique device ID
  - Associates with user & optional machine
  - Stores initial device metadata
- **Listing:** GET `/api/devices`
  - Returns all devices with current status
- **Status Tracking:** Auto-updates `online`, `offline`, `anomaly` states
- **Deletion:** DELETE `/api/devices/:deviceId`

#### **Real-time Data Ingestion**
- **Single Reading:** POST `/api/data`
  - Accepts one sensor reading
  - Returns anomaly analysis result
- **Batch Upload:** POST `/api/data/batch`
  - Accepts up to 120 readings at once
  - Used by ESP32 when recovering from offline mode
  - Processes each reading and returns aggregated anomaly summary
- **Retrieval:** GET `/api/data/:deviceId`
  - Returns historical readings (newest first)
  - With pagination support

#### **Anomaly Detection Engine**
- **Hybrid Three-Tier System:**
  1. **ML Model (Primary)** → Calls Python Flask service
  2. **Statistical Fallback** → Uses ±2σ thresholds
  3. **Hard Limits** → Maximum bounds (always active)
- **Detailed Analysis:**
  - Computes per-feature anomaly reasons
  - Returns severity classification (warning/critical)
  - Logs ML usage vs. statistical fallback

#### **Machine Calibration**
- **Start Calibration:** POST `/api/machines/:machineId/calibrate`
  - Sets `calibrationStatus: 'calibrating'`
  - Opens 120-second collection window
  - Stores all readings in baseline buffer
- **Finalize:** Auto-triggers after 120s
  - Computes mean for sound energy, frequency, vibration, current
  - Sets baseline thresholds (baseline value ± 20%)
  - Sets `calibrationStatus: 'ready'`
- **Validation:** Rejects calibration if variance too high (machine not stable)

#### **Notification System**
- **Alert Creation:** Triggered on first anomaly detection
  - Creates Notification document with timestamp
  - Stores device ID, severity, message
- **WebPush Dispatch:** Sends to all subscribed browsers if critical
- **Acknowledgment:** PATCH endpoint to mark alert as read
- **History:** Maintains full alert audit trail

#### **Status Monitoring**
- **Online Detection:** Updates device `lastSeen` on every reading
- **Offline Detection:** Periodically checks for idle devices (>30s no readings)
- **Anomaly Status:** Sets `status: 'anomaly'` when first anomaly detected
- **Auto-recovery:** Clears anomaly flag after period of normal readings

---

### 3. Hardware Integration (ESP32)

#### **Sensor Suite**

**INMP441 Digital Microphone (I2S Input)**
- **Pins:** WS=25, SD=33, SCK=26
- **Sampling Rate:** 16 kHz
- **FFT Analysis:** 128-point FFT to extract frequency domain features
- **Outputs:**
  - Sound Energy: RMS (root mean square) amplitude
  - Dominant Frequency: Peak frequency in Hz (0–8000 Hz range)

**Vibration Detector (GPIO 27)**
- Digital input tied to vibration sensor
- Returns: NORMAL / DETECTED / HIGH

**Current Sensor (ADC1_CH6 / GPIO34)**
- Analog-to-digital conversion
- Range: 0.0–1.2A power draw
- Used for motor load monitoring

#### **Key Features**

**Offline Buffering:**
- Circular buffer stores up to 120 readings when WiFi unavailable
- Each reading: `{soundEnergy, frequency, vibration, current, timestamp}`
- Prevents data loss during disconnection

**Batch Upload:**
- When WiFi reconnects, sends all buffered readings
- Endpoint: POST `/api/data/batch`
- Server processes in order and updates anomaly status

**Auto-Reconnection:**
- Exponential backoff if connection fails
- Periodically attempts to reconnect
- Beeps/LED indicators for status

**Device Configuration:**
- Unique device ID (e.g., `DIGITAL_EAR_01`)
- WiFi SSID & password storage
- Server endpoint configuration
- Calibration mode flag

**Data Collection Frequency:**
- Typical interval: 2–5 seconds per reading
- Adjustable via firmware settings
- 120 readings ≈ 10–15 minutes offline capacity

---

### 4. ML/AI Components

#### **Anomaly Detection Service** (`server/services/anomalyDetector.js`)

**Three-Tier Detection Strategy:**

##### **Tier 1: ML Model (Primary)**
- **Service:** Python Flask microservice on `http://localhost:5001`
- **Models:**
  - **Isolation Forest:** Detects statistical outliers by isolating anomalous samples
  - **One-Class SVM:** Learns boundary of "normal" operating region
- **Training Data:** Readings with `isAnomaly: false` from MongoDB
- **Input Features:** `[soundEnergy, frequency, vibration (0-1), current]`
- **Output:** `{prediction: [0|1], anomaly_score: float}`

##### **Tier 2: Statistical Fallback**
- Triggered if ML service unavailable (port 5001 unreachable)
- **Rolling window:** Last 60 readings per device
- **Threshold Calculation:** Mean ± 2×StdDev per feature
- **Detection:** Flag if any feature exceeds ±2σ
- **Output:** Returns `σ_deviations` for each feature

##### **Tier 3: Hard Limits (Always Active)**
- Sound Energy: max 60,000
- Frequency: min 300 Hz, max 2,000 Hz
- Current: max 1.2 A
- Flags violations regardless of ML/stats availability

**Result Payload:**
```javascript
{
  isAnomaly: Boolean,
  reasons: ["Sound energy spike (2.3σ)", "Current surge (3.1σ)"],
  severity: 'warning' | 'critical',  // warning: 1 sigma, critical: 2+ sigma
  mlUsed: Boolean,                    // indicates which tier was used
  scores: {
    soundEnergy: -0.5,       // sigma deviations
    frequency: 1.8,
    current: 2.2
  }
}
```

#### **ML Training Service** (`server/ml/server.py`)

**Technologies:**
- Flask web framework
- scikit-learn for ML models
- NumPy for numerical computation
- MongoDB driver for data fetching

**Endpoints:**
- `GET /health` — Service health check
- `POST /predict` — Single prediction on sensor reading
- `POST /train` — Retrain models from MongoDB
- `GET /info` — Model metadata (training samples, feature stats)

**Training Pipeline:**
1. Fetch all non-anomaly readings from MongoDB (`isAnomaly: false`)
2. Generate synthetic baseline if <30 samples available
3. Fit Isolation Forest (contamination=0.1)
4. Fit One-Class SVM (nu=0.1)
5. Standardize features using StandardScaler
6. Save models & metadata

**Synthetic Data Generation:**
- If insufficient real data, generates 200 synthetic samples
- Baseline: slight Gaussian noise around typical values
- Ensures model trains even with limited initial data

---

## Database & Data Models

### MongoDB Collections & Schemas

#### **User Collection**
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (bcrypt hashed),
  otp: String (optional),              // for password reset
  otpExpiry: Date,                     // 15 minutes validity
  createdAt: Date,
  updatedAt: Date
}
```

#### **Device Collection**
```javascript
{
  _id: ObjectId,
  deviceId: String (unique),           // e.g., "DIGITAL_EAR_01"
  name: String,
  status: enum['online', 'offline', 'anomaly'],
  lastSeen: Date,                      // timestamp of last reading
  registeredBy: ObjectId (ref: User),
  attachedMachine: ObjectId (ref: Machine),
  calibrationEndTime: Date,            // when calibration window closes
  registeredAt: Date,
  updatedAt: Date
}
```

#### **Machine Collection**
```javascript
{
  _id: ObjectId,
  name: String (unique),
  deviceAttached: ObjectId (ref: Device),
  status: enum['running', 'scheduled_off'],
  isCalibrated: Boolean,
  calibrationStatus: enum['none', 'calibrating', 'ready', 'failed'],
  calibrationError: String,            // e.g., "Variance too high"
  needsMaintenance: Boolean,
  baseline: {
    soundEnergy: Number,               // mean ± 20%
    frequency: Number,
    vibrationLevel: Number (0.0–1.0),
    current: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### **SensorReading Collection**
```javascript
{
  _id: ObjectId,
  deviceId: String,                    // matches Device.deviceId
  soundEnergy: Number,                 // RMS amplitude
  frequency: Number,                   // dominant frequency in Hz
  vibration: enum['NORMAL', 'DETECTED', 'HIGH'],
  current: Number,                     // amps
  timestamp: Date (default: now),
  isAnomaly: Boolean,                  // computed by anomaly detector
  anomalyReason: [String],             // reasons if anomaly
  anomalySeverity: enum['warning', 'critical']
}
```

#### **Notification Collection**
```javascript
{
  _id: ObjectId,
  deviceId: String,
  machineId: String,
  message: String,                     // user-friendly alert text
  severity: enum['warning', 'critical'],
  timestamp: Date,
  acknowledged: Boolean (default: false),
  acknowledgedAt: Date,
  updatedAt: Date
}
```

#### **Subscription Collection** (WebPush)
```javascript
{
  _id: ObjectId,
  endpoint: String (unique),           // browser push service endpoint
  keys: {
    p256dh: String,                    // encryption key
    auth: String                       // authentication secret
  },
  createdAt: Date
}
```

---

## Authentication System

### Flow Diagram

```
                  ┌──────────────────┐
                  │   User         │
                  └────────┬─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    ┌───▼─────┐       ┌────▼────┐        ┌──▼──────┐
    │ Signup  │       │  Login   │        │ Forgot  │
    │         │       │          │        │Password │
    └─────────┘       └────┬─────┘        └────┬────┘
          │                 │                   │
          │          ┌──────▼──────┐        ┌──▼──────────┐
          │          │JWT Token    │        │OTP Email    │
          │          │(7-day exp)  │        │(15-min exp) │
          └──────────┼─────────────┼────────┴──┬──────────┘
                     │             │           │
              ┌──────▼─────────────▼────┐  ┌──▼──────┐
              │Frontend Auth Context    │  │Verify   │
              │(JWT in localStorage)    │  │OTP      │
              └────────────────────┬────┘  └────┬────┘
                                   │            │
                              ┌────▼────────────▼──┐
                              │ Reset Password     │
                              │ Set new bcrypt hash│
                              └────────────────────┘
```

### Implementation Details

**Signup Process:**
1. Client POST `/api/auth/signup` with `{name, email, password}`
2. Backend validates email uniqueness
3. Hashes password with bcrypt (10 salt rounds)
4. Creates User document
5. Generates JWT token (payload: `{userId, email}`, expires 7 days)
6. Returns token to client

**Login Process:**
1. Client POST `/api/auth/login` with `{email, password}`
2. Backend finds User by email
3. Compares plaintext password with bcrypt hash
4. If match, generates and returns JWT token
5. Client stores token in localStorage

**Password Reset (3-step):**
1. **Forgot Password:** POST `/api/auth/forgot-password`
   - Generates random 6-digit OTP
   - Saves OTP + 15-minute expiry to User document
   - Sends OTP via Resend email API
2. **Verify OTP:** POST `/api/auth/verify-otp`
   - Validates OTP matches and hasn't expired
   - Returns temporary validation token
3. **Reset Password:** POST `/api/auth/reset-password`
   - Accepts new password + validation token
   - Hashes new password with bcrypt
   - Clears OTP from document
   - Returns login JWT token

**Route Protection:**
- Frontend: `ProtectedRoute` wrapper checks localStorage JWT
- Redirects to `/login` if token missing or expired
- Backend: `authMiddleware` verifies JWT on protected routes

---

## Hardware Integration

### ESP32 Sensor Setup

#### **I2S Audio Microphone (INMP441)**

**Pinout:**
```
INMP441         ESP32
─────────       ─────
WS      ──────  GPIO 25 (Word Select / Left-Right Clock)
SD      ──────  GPIO 33 (Serial Data)
SCK     ──────  GPIO 26 (Serial Clock)
GND     ──────  GND
VCC     ──────  3.3V
```

**Configuration:**
- **Sampling Rate:** 16,000 Hz
- **Bit Depth:** 16-bit signed
- **Channels:** Mono (1 channel)
- **DMA Buffer:** 1024 samples per interrupt

**Signal Processing:**
- Records 256 samples (~16 ms)
- Applies Hann window for FFT
- Computes 128-point FFT
- Extracts:
  - **Sound Energy:** RMS of raw samples
  - **Dominant Frequency:** Bin with maximum magnitude

#### **Vibration Detector (GPIO 27)**

**Configuration:**
- Digital input with internal pull-up
- Reads every 100 ms
- Debounced over 3 consecutive reads
- Returns: NORMAL / DETECTED / HIGH

#### **Current Sensor (ADC1_CH6, GPIO 34)**

**Configuration:**
- Analog-to-digital converter
- 12-bit resolution (0–4095 counts)
- Voltage divider: 3.3V reference
- Mapped to: 0.0–1.2A range
- Smoothing: 10-sample moving average

### Offline Buffering & Recovery

**Circular Buffer (120 entries):**
```javascript
class ReadingBuffer {
  constructor() {
    this.buffer = [];
    this.maxSize = 120;
    this.index = 0;
  }
  
  add(reading) {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(reading);
    } else {
      this.buffer[this.index] = reading;
      this.index = (this.index + 1) % this.maxSize;
    }
  }
  
  getAll() {
    return this.buffer.length === this.maxSize
      ? [...this.buffer.slice(this.index), ...this.buffer.slice(0, this.index)]
      : this.buffer;
  }
}
```

**Recovery Process:**
1. ESP32 detects WiFi reconnection
2. Calls `POST /api/data/batch` with buffered readings
3. Server processes each reading (anomaly detection, storage)
4. Returns summary: `{processed: 120, anomalies: 3}`
5. ESP32 clears buffer and resumes normal operation

### Data Collection Frequency

- **Default Interval:** 2–5 seconds per reading
- **Offline Capacity:** ~15–20 minutes (120 readings at 5s intervals)
- **Adjustable:** Via firmware configuration or OTA update

---

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/signup` | `{name, email, password}` | `{token, user: {id, email}}` |
| POST | `/login` | `{email, password}` | `{token, user: {id, email}}` |
| POST | `/forgot-password` | `{email}` | `{message: "OTP sent"}` |
| POST | `/verify-otp` | `{email, otp}` | `{valid: true}` |
| POST | `/reset-password` | `{email, otp, newPassword}` | `{token, message}` |

### Data (`/api/data`)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/data` | `{deviceId, soundEnergy, frequency, vibration, current}` | `{saved: true, isAnomaly: bool, ...}` |
| POST | `/data/batch` | `{deviceId, readings: [{...}, ...]}` | `{processed: 120, anomalies: 3}` |
| GET | `/data/:deviceId` | — | `{readings: [{...}, ...], count: N}` |
| GET | `/data/active-devices` | — | `{devices: [{deviceId, lastReading, ...}]}` |

### Devices (`/api/devices`)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/register` | `{deviceId, name}` | `{device: {id, deviceId, status}}` |
| GET | `/` | — | `{devices: [{...}, ...]}` |
| DELETE | `/:deviceId` | — | `{message: "Device deleted"}` |
| GET | `/stoppages` | — | `{stoppedDevices: [{deviceId, lastSeen}]}` |

### Machines (`/api/machines`)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/` | — | `{machines: [{...}, ...]}` |
| POST | `/` | `{name, deviceAttached}` | `{machine: {...}}` |
| POST | `/:machineId/calibrate` | — | `{status: "calibrating", endTime: Date}` |
| GET | `/:machineId/calibration-status` | — | `{status: "calibrating"\|"ready"\|"failed", progress: 0–100}` |
| PATCH | `/:machineId/maintenance-complete` | — | `{needsMaintenance: false}` |
| PATCH | `/:machineId/status` | `{status: "running"\|"scheduled_off"}` | `{machine: {...}}` |

### ML Service (`/api/ml`)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/train` | — | `{trained: true, samples: 450, features: 4}` |
| GET | `/info` | — | `{model: "Isolation Forest + SVM", samples: 450}` |
| GET | `/health` | — | `{status: "ok"}` or error |

### Notifications (`/api/notifications`)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/subscribe` | `{endpoint, keys: {p256dh, auth}}` | `{message: "Subscribed"}` |
| GET | `/notifications` | — | `{notifications: [{...}, ...]}` |
| GET | `/notifications/:deviceId` | — | `{notifications: [{...}, ...]}` |
| PATCH | `/notifications/:id/acknowledge` | — | `{acknowledged: true}` |

---

## Frontend Pages & Components

### Pages (`src/pages/`)

#### **Login Page**
- Email & password input fields
- "Forgot Password?" link
- "Sign up" link
- JWT token stored in localStorage on success
- Session persistence on app load

#### **Signup Page**
- Name, email, password input fields
- Password confirmation
- Validation feedback
- Auto-redirect to dashboard on success

#### **Dashboard Page**
- **Hero Stats:** Active devices, machines, anomalies today
- **Machine Grid:** Cards showing status, calibration button, last reading
- **Device List:** Inline devices with status badge, last seen time
- **Real-time Updates:** `setInterval` polling every 2 seconds

#### **DeviceDetail Page**
- Device name & current status
- **Recharts Graphs:**
  - Sound Energy vs. Time
  - Frequency Domain vs. Time
  - Current Consumption vs. Time
  - Anomaly Timeline (markers + severity colors)
- Real-time values with timestamps
- Statistics sidebar (min, max, avg)

#### **MotorTwin Page** (3D Visualization)
- **MotorViewer Canvas:** Three.js scene with:
  - 3D motor model (cylinder + rotor)
  - Lighting (ambient + point lights)
  - Grid background
  - OrbitControls for camera interaction
- **Real-time Animation:**
  - Motor rotation speed synced to frequency readings
  - Color changes based on health (green → yellow → red)
- **StatusPanel:** Side panel showing:
  - Machine state
  - Current health score
  - Temperature gauge
  - Vibration indicator
  - Maintenance status

#### **ConnectDevice Page**
- Step-by-step WiFi pairing wizard
- Display device ID & QR code
- Network selection dropdown
- Password input
- Confirmation screen

#### **Notifications Page**
- List all anomaly alerts
- Filter by severity (warning/critical)
- Filter by device
- Mark as read/unread
- Timestamp for each alert

#### **Forgot Password → Verify OTP → Reset Password**
- Multi-step form flow
- Email input on first screen
- OTP input on second screen (6 digits)
- New password input on third screen
- Success confirmation

### Components (`src/components/`)

| Component | Purpose | Props |
|-----------|---------|-------|
| `MotorModel` | 3D motor mesh geometry | `health`, `temperature`, `rotation` |
| `MotorViewer` | Canvas wrapper with camera | `machineData`, `onUpdate` |
| `SensorStats` | 4-stat inline card grid | `rpm`, `temp`, `vibration`, `current` |
| `StatusPanel` | Machine state side panel | `machine`, `device`, `alerts` |
| `MachineCard` | Grid card with status & calibration | `machine`, `onCalibrate` |
| `DeviceCard` | Inline device item | `device`, `onDelete`, `onDetail` |
| `DashboardCard` | Hero stat card with trend | `label`, `value`, `trend`, `icon` |
| `CalibrationModal` | Modal to start baseline collection | `machine`, `onConfirm`, `onCancel` |
| `Header` | Navigation bar with user menu | `user`, `onLogout` |
| `Sidebar` | Side navigation menu | `currentPage`, `onNavigate` |
| `Layout` | Page wrapper (Sidebar + Header + content) | `children`, `currentPage` |

### Styling

**Tailwind CSS v4:**
- Base styling with `index.css`
- Custom color palette (dark theme + blue accent)
- Responsive grid layouts (`md:grid-cols-2`, `lg:grid-cols-3`)
- Spacing scale (4px base unit)

**Custom CSS (motor.css):**
```css
@keyframes spin-slow {
  from { transform: rotateZ(0deg); }
  to { transform: rotateZ(360deg); }
}

@keyframes pulse-glow {
  0%, 100% { filter: drop-shadow(0 0 8px #adc6ff); }
  50% { filter: drop-shadow(0 0 16px #adc6ff); }
}

.motor-rotor {
  animation: spin-slow 3s linear infinite;
}

.status-critical {
  animation: pulse-glow 1s ease-in-out infinite;
}
```

---

## External Services & Integrations

### Email Service (Resend)

**Purpose:** Send OTP emails for password reset

**Package:** `resend@6.12.3`

**Configuration:**
- Environment: `RESEND_API_KEY`
- Sender: Typically `noreply@yourdomain.com`

**Usage:**
```javascript
// In authController.js
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "Digital Ear <onboarding@resend.dev>",
  to: email,
  subject: "Your OTP for Password Reset",
  html: `<p>Your OTP is: ${otp}</p>`
});
```

**Fallback:** Logs OTP to server console if no API key configured

### Web Push Notifications (VAPID)

**Purpose:** Send real-time browser notifications on critical anomalies

**Package:** `web-push@3.6.7`

**Configuration:**
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@digitaleear.app
```

**Flow:**
1. Client: `POST /api/notifications/subscribe` with browser push subscription
2. Server: Stores subscription in MongoDB
3. Alert Trigger: `POST /api/data` detects critical anomaly
4. Server: Sends WebPush to all subscribers with message
5. Browser: Shows toast notification (6-second auto-dismiss)

**Payload:**
```javascript
{
  title: "Critical Anomaly Detected",
  body: "Machine XYZ showing sound energy spike. Check dashboard.",
  icon: "/logo.png",
  badge: "/badge.png",
  requireInteraction: false,
  data: { deviceId, machineId, timestamp }
}
```

### MongoDB

**Purpose:** Persistent data storage

**Package:** `mongoose@8.6.3`

**Connection:**
```
MONGO_URI=mongodb://localhost:27017/digital_ear
```

**Collections:**
- `users` — User accounts
- `devices` — ESP32 devices
- `machines` — Equipment being monitored
- `sensorreadings` — Time-series sensor data
- `notifications` — Alert history
- `subscriptions` — WebPush subscriptions

**Indexing:**
- `sensorreadings.deviceId` + `sensorreadings.timestamp` (for fast queries)
- `devices.deviceId` (unique)
- `machines.name` (unique)
- `subscriptions.endpoint` (unique)

### ML Microservice (Python Flask)

**Purpose:** Anomaly detection using ML models

**Location:** `server/ml/`

**Technologies:**
- Flask 3.0.0
- scikit-learn 1.3.2
- NumPy 1.24.3
- MongoDB Python driver

**Port:** 5001

**Endpoints:**
- `GET /health` — Service health
- `POST /predict` — Predict on single reading
- `POST /train` — Retrain from MongoDB
- `GET /info` — Model metadata

**Models:**
- Isolation Forest (contamination=0.1)
- One-Class SVM (nu=0.1, kernel='rbf')

---

## Data Flow Diagram

### Complete End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. HARDWARE COLLECTION (ESP32)                                  │
│    - Read I2S audio every ~5s                                   │
│    - FFT → sound energy, frequency                              │
│    - Read ADC current & GPIO vibration                          │
│    - Store in circular buffer if WiFi down                      │
└──────────────────┬──────────────────────────────────────────────┘
                   │ JSON POST
┌──────────────────▼──────────────────────────────────────────────┐
│ 2. INGESTION (Backend /api/data or /api/data/batch)             │
│    - Validate device exists                                     │
│    - Update Device.lastSeen & Device.status                    │
│    - If CALIBRATING: add to baseline buffer                     │
│    - Else: proceed to anomaly analysis                          │
└──────────────────┬──────────────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │ Check Calibration   │
        │ Status              │
        └──────┬──────────────┘
               │
        ┌──────┴──────────────────┐
        │ YES (Calibrating)       │ NO (Normal Mode)
        │                         │
    ┌───▼─────┐            ┌─────▼──────────┐
    │Store in │            │Anomaly Analysis│
    │baseline │            └─────┬──────────┘
    │buffer   │                  │
    └─────────┘          ┌───────▼────────────┐
                         │ Try ML Service     │
                         │ (port 5001)        │
                         │ Predict:           │
                         │ isAnomaly?         │
                         └───┬──────┬─────────┘
                             │      │
                        ┌────▼──┐  └─► No ML →
                        │Success│        ┌─────────────┐
                        └────┬──┘        │Statistical │
                             │          │Fallback:   │
                        ┌────▼──────────┤±2σ check   │
                        │Use ML result  └─────────────┘
                        └────┬──────┐
                             │      │
                     ┌────────▼──┐  └─► Hard Limits
                     │Check hard │      (sound, freq,
                     │limits also│       current max)
                     └────┬──────┘
                          │
                ┌─────────▼────────────┐
                │ isAnomaly?           │
                └──────┬────────┬──────┘
                       │        │
                ┌──────▼──┐   ┌─▼────────────┐
                │YES      │   │NO            │
                │         │   │ Save reading │
                │         │   │ isAnomaly=F  │
                └────┬────┘   └──────────────┘
                     │
            ┌────────▼───────────┐
            │ First anomaly for  │
            │ this device/period?│
            └────────┬───────────┘
                     │
            ┌────────▼────────────────┐
            │ Create Notification     │
            │ Store in MongoDB        │
            │ Save SensorReading      │
            │ isAnomaly=T             │
            │ anomalyReason=[...]     │
            │ anomalySeverity=warning │
            │ or critical             │
            └────────┬────────────────┘
                     │
            ┌────────▼────────────────┐
            │ Update Device.status    │
            │ = 'anomaly'             │
            └────────┬────────────────┘
                     │
            ┌────────▼────────────────┐
            │ Dispatch WebPush Notif  │
            │ to all subscribers      │
            └────────┬────────────────┘
                     │
                ┌────▼───┐
                │Done    │
                └────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3. FRONTEND POLLING (React)                                     │
│    - setInterval every 2–5 seconds                              │
│    - Fetch: GET /api/data/:deviceId                             │
│    - Fetch: GET /api/notifications                              │
│    - Update Recharts graphs in real-time                        │
│    - Update 3D motor animation (rotation speed)                 │
│    - Toast alert if new critical notification                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | React | 19.0.0 | Component-based UI |
| **Bundler** | Vite | 6.3.0 | Fast dev server & build |
| **Styling** | Tailwind CSS | 4.0.0 | Utility-first CSS |
| **3D Graphics** | Three.js | Latest | 3D rendering engine |
| **3D React** | React Three Fiber | Latest | Three.js abstractions |
| **Charts** | Recharts | Latest | React chart library |
| **HTTP** | Axios / Fetch | Native | API calls |
| **State** | React Context | Built-in | Global JWT auth state |
| **Router** | React Router | v6+ | Client-side routing |

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 18+ | JavaScript runtime |
| **Framework** | Express | 5.0.0 | HTTP server |
| **Database** | MongoDB | 5.0+ | Document store |
| **ODM** | Mongoose | 8.6.3 | MongoDB abstraction |
| **Auth** | jsonwebtoken | 9.1.2 | JWT token generation |
| **Password** | bcryptjs | 2.4.3 | Password hashing |
| **Validation** | joi | 17.11.0 | Input validation |
| **Email** | resend | 6.12.3 | SMTP service |
| **Push** | web-push | 3.6.7 | WebPush library |
| **CORS** | cors | 2.8.5 | Cross-origin requests |
| **Env** | dotenv | 16.3.1 | Environment variables |

### ML Service

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Flask | 3.0.0 | Python web server |
| **ML** | scikit-learn | 1.3.2 | Machine learning models |
| **Numerical** | NumPy | 1.24.3 | Array operations |
| **Database** | pymongo | 4.5.0 | MongoDB client |
| **HTTP** | requests | 2.31.0 | HTTP library |

### Hardware

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **MCU** | ESP32 | Main microcontroller |
| **Microphone** | INMP441 (I2S) | Audio input |
| **ADC** | Internal ADC (ADS1115) | Analog-to-digital conversion |
| **Connectivity** | WiFi 802.11 b/g/n | Wireless connectivity |
| **Protocol** | HTTP/JSON | Communication protocol |

---

## Deployment Checklist

### Prerequisites
- [ ] MongoDB instance (local or Atlas)
- [ ] Node.js v18+
- [ ] Python 3.10+
- [ ] ESP32 board + microphone + sensors
- [ ] Resend API key for email
- [ ] VAPID keys for WebPush
- [ ] Environment variables configured

### Backend Setup
```bash
cd server
npm install
# Create .env file with:
# MONGO_URI, RESEND_API_KEY, VAPID_*, JWT_SECRET, PORT, ML_SERVICE_URL

npm run dev
```

### Frontend Setup
```bash
cd client
npm install
npm run dev
```

### ML Service Setup
```bash
cd server/ml
pip install -r requirements.txt
python server.py
```

### Hardware Setup
1. Flash `server/digital_ear_esp32.ino` to ESP32
2. Configure WiFi SSID/PASSWORD in firmware
3. Set server endpoint IP address
4. Power on and device will register automatically

---

## Summary

**Digital Ear** is a **production-ready, full-stack IoT predictive maintenance platform** that integrates:

✅ **Real-time sensor fusion** (audio + electrical + vibration)
✅ **Hybrid anomaly detection** (ML + statistical + hard limits)
✅ **Offline resilience** (circular buffering + batch recovery)
✅ **Instant alerts** (WebPush + in-app notifications)
✅ **3D visualization** (interactive motor twin)
✅ **Robust authentication** (JWT + OTP password reset)
✅ **Graceful degradation** (fallback mechanisms at every layer)

With careful engineering for reliability, scalability, and user experience, this system can significantly reduce industrial equipment downtime and maintenance costs.
