/*
 * ========================================================
 *  DIGITAL EAR — ESP32 + INMP441 MEMS Microphone Firmware
 * ========================================================
 *
 *  Hardware:
 *    ESP32 DevKit V1
 *    INMP441 I2S MEMS Microphone
 *      - SCK  → GPIO 14
 *      - WS   → GPIO 15
 *      - SD   → GPIO 32
 *      - L/R  → GND (left channel)
 *      - VDD  → 3.3V
 *      - GND  → GND
 *
 *  What it does:
 *    1. Reads audio samples from INMP441 via I2S at 16kHz
 *    2. Performs FFT (1024-point) to extract dominant frequency
 *    3. Computes sound energy from raw samples
 *    4. Detects vibration via energy threshold
 *    5. Reads current from analog pin (ACS712 or similar)
 *    6. Sends JSON payload to MERN backend via HTTP POST every 1 second
 *
 *  Libraries required (install via Arduino Library Manager):
 *    - ArduinoJson (by Benoit Blanchon)
 *    - arduinoFFT  (by Kosme)
 *
 *  Configuration:
 *    Update WIFI_SSID, WIFI_PASSWORD, and SERVER_URL below.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <driver/i2s.h>
#include <arduinoFFT.h>

// ==================== CONFIGURATION ====================
#define WIFI_SSID          "YOUR_WIFI_SSID"
#define WIFI_PASSWORD      "YOUR_WIFI_PASSWORD"
#define SERVER_URL         "http://YOUR_SERVER_IP:5000/api/data"
#define DEVICE_ID          "ESP32-01"

// ==================== I2S PINS (INMP441) ===============
#define I2S_SCK            14
#define I2S_WS             15
#define I2S_SD             32
#define I2S_PORT           I2S_NUM_0

// ==================== FFT SETTINGS =====================
#define SAMPLES            1024
#define SAMPLING_FREQ      16000
#define CURRENT_PIN        34   // Analog pin for current sensor

// ==================== THRESHOLDS =======================
#define VIBRATION_THRESHOLD  40000.0  // Sound energy above this → vibration detected

// ==================== GLOBALS ==========================
double vReal[SAMPLES];
double vImag[SAMPLES];

ArduinoFFT<double> FFT = ArduinoFFT<double>(vReal, vImag, SAMPLES, SAMPLING_FREQ);

unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 1000; // 1 second

// ==================== I2S SETUP ========================
void setupI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLING_FREQ,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 256,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);
  i2s_zero_dma_buffer(I2S_PORT);
}

// ==================== WIFI =============================
void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("[WiFi] Connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("[WiFi] Connection failed. Will retry...");
  }
}

void ensureWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Reconnecting...");
    WiFi.disconnect();
    delay(1000);
    connectWiFi();
    delay(5000);  // Wait 5 seconds before retrying
  }
}

// ==================== AUDIO CAPTURE ====================
void captureAudio() {
  int32_t raw_samples[SAMPLES];
  size_t bytes_read;

  i2s_read(I2S_PORT, (void *)raw_samples, sizeof(raw_samples), &bytes_read, portMAX_DELAY);

  int samples_read = bytes_read / sizeof(int32_t);

  for (int i = 0; i < samples_read && i < SAMPLES; i++) {
    vReal[i] = (double)(raw_samples[i] >> 14);  // Normalize 32-bit to usable range
    vImag[i] = 0.0;
  }

  // Zero-pad if we didn't get enough samples
  for (int i = samples_read; i < SAMPLES; i++) {
    vReal[i] = 0.0;
    vImag[i] = 0.0;
  }
}

// ==================== COMPUTE METRICS ==================
float computeSoundEnergy() {
  double energy = 0;
  for (int i = 0; i < SAMPLES; i++) {
    energy += vReal[i] * vReal[i];
  }
  return (float)(energy / SAMPLES);
}

float computeDominantFrequency() {
  FFT.windowing(FFT_WIN_TYP_HAMMING, FFT_FORWARD);
  FFT.compute(FFT_FORWARD);
  FFT.complexToMagnitude();
  return (float)FFT.majorPeak();
}

float readCurrent() {
  // Read from ACS712 or similar current sensor on analog pin
  // Assuming 5A module: 185mV/A, midpoint at ~2.5V (2048 on 12-bit ADC)
  int raw = analogRead(CURRENT_PIN);
  float voltage = (raw / 4095.0) * 3.3;
  float current = abs((voltage - 1.65) / 0.185);  // Adjusted for 3.3V reference
  return current;
}

// ==================== SEND DATA ========================
void sendDataToServer(float soundEnergy, float frequency, bool vibrationDetected, float current) {
  ensureWiFi();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Skipping send — no WiFi");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["soundEnergy"] = soundEnergy;
  doc["frequency"] = frequency;
  doc["vibration"] = vibrationDetected ? "DETECTED" : "NORMAL";
  doc["current"] = current;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0) {
    Serial.printf("[HTTP] Response: %d\n", httpCode);
  } else {
    Serial.printf("[HTTP] Error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// ==================== SETUP ============================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println();
  Serial.println("==============================");
  Serial.println("   DIGITAL EAR — ESP32 Node   ");
  Serial.println("==============================");
  Serial.printf("Device ID: %s\n", DEVICE_ID);

  // Initialize peripherals
  analogReadResolution(12);
  setupI2S();
  connectWiFi();

  Serial.println("[SYSTEM] Initialization complete. Starting data loop...");
}

// ==================== MAIN LOOP ========================
void loop() {
  unsigned long now = millis();

  if (now - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = now;

    // 1. Capture audio from INMP441
    captureAudio();

    // 2. Compute metrics
    float soundEnergy = computeSoundEnergy();
    float frequency = computeDominantFrequency();
    float current = readCurrent();
    bool vibrationDetected = soundEnergy > VIBRATION_THRESHOLD;

    // 3. Debug output
    Serial.println("--- Sensor Reading ---");
    Serial.printf("  Sound Energy : %.2f\n", soundEnergy);
    Serial.printf("  Frequency    : %.2f Hz\n", frequency);
    Serial.printf("  Vibration    : %s\n", vibrationDetected ? "DETECTED" : "NORMAL");
    Serial.printf("  Current      : %.3f A\n", current);
    Serial.println("----------------------");

    // 4. Send to backend
    sendDataToServer(soundEnergy, frequency, vibrationDetected, current);
  }
}
