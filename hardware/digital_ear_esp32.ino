#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <driver/i2s.h>
#include <driver/adc.h>
#include <arduinoFFT.h>

// =====================================================
// ================= CONFIGURATION =====================
// =====================================================

#define WIFI_SSID          "YOUR_WIFI_SSID"
#define WIFI_PASSWORD      "YOUR_WIFI_PASSWORD"
#define SERVER_URL         "http://192.168.0.109:5000/api/data"

// =====================================================
// ================= DEVICE INFO ========================
// =====================================================

String DEVICE_ID = "DIGITAL_EAR_01";

// =====================================================
// ================= MIC PINS ===========================
// =====================================================

#define I2S_WS   25
#define I2S_SD   33
#define I2S_SCK  26

// =====================================================
// ================= SENSOR PINS ========================
// =====================================================

#define VIB_PIN 27

// GPIO34 = ADC1_CHANNEL_6
#define CURRENT_CHANNEL ADC1_CHANNEL_6

// =====================================================
// ================= FFT SETTINGS =======================
// =====================================================

#define SAMPLES 128
#define SAMPLING_FREQUENCY 16000

double vReal[SAMPLES];
double vImag[SAMPLES];

ArduinoFFT<double> FFT(
  vReal,
  vImag,
  SAMPLES,
  SAMPLING_FREQUENCY
);

int32_t samples[SAMPLES];

// =====================================================
// ================= CURRENT VARIABLES ==================
// =====================================================

int baseline = 0;
bool calibrated = false;

// =====================================================
// ================= WIFI FUNCTIONS =====================
// =====================================================

void connectWiFi() {
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi Connection Failed!");
  }
}

// =====================================================
// ================= HTTP SEND DATA ====================
// =====================================================

void sendDataToServer(float soundEnergy, float frequency, String vibrationStatus, float currentVal) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi not connected. Reconnecting...");
    connectWiFi();
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Create JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["soundEnergy"] = soundEnergy;
  doc["frequency"] = frequency;
  doc["vibration"] = vibrationStatus;
  doc["current"] = currentVal;

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.print("Sending payload: ");
  Serial.println(requestBody);

  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    Serial.print("🌐 Server Response: [");
    Serial.print(httpResponseCode);
    Serial.println("]");
    
    String response = http.getString();
    Serial.println("Response body: " + response);
  } else {
    Serial.print("❌ Error sending POST request: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

// =====================================================
// ================= SETUP ==============================
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println("================================");
  Serial.println("🚀 DIGITAL EAR SYSTEM STARTING");
  Serial.println("================================");

  Serial.print("📟 DEVICE ID: ");
  Serial.println(DEVICE_ID);

  // ================= WIFI CONFIG =================
  connectWiFi();

  // ================= VIBRATION =================

  pinMode(VIB_PIN, INPUT);

  // ================= ADC CONFIG =================

  adc1_config_width(ADC_WIDTH_BIT_12);

  adc1_config_channel_atten(
    CURRENT_CHANNEL,
    ADC_ATTEN_DB_11
  );

  // ================= I2S CONFIG =================

  i2s_config_t i2s_config = {

    .mode =
      (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),

    .sample_rate = SAMPLING_FREQUENCY,

    .bits_per_sample =
      I2S_BITS_PER_SAMPLE_32BIT,

    .channel_format =
      I2S_CHANNEL_FMT_ONLY_LEFT,

    .communication_format =
      I2S_COMM_FORMAT_I2S,

    .intr_alloc_flags = 0,

    .dma_buf_count = 8,

    .dma_buf_len = 64
  };

  i2s_pin_config_t pin_config = {

    .bck_io_num = I2S_SCK,

    .ws_io_num = I2S_WS,

    .data_out_num = -1,

    .data_in_num = I2S_SD
  };

  i2s_driver_install(
    I2S_NUM_0,
    &i2s_config,
    0,
    NULL
  );

  i2s_set_pin(
    I2S_NUM_0,
    &pin_config
  );

  Serial.println("✅ Setup Complete");
}

// =====================================================
// ================= LOOP ===============================
// =====================================================

void loop() {
  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // =====================================================
  // ================= SOUND PROCESSING ==================
  // =====================================================

  size_t bytes_read;

  i2s_read(
    I2S_NUM_0,
    samples,
    sizeof(samples),
    &bytes_read,
    portMAX_DELAY
  );

  double energy = 0;

  for (int i = 0; i < SAMPLES; i++) {

    vReal[i] = samples[i] / 10000.0;

    vImag[i] = 0;

    energy += abs(vReal[i]);
  }

  // ================= MIC NOISE FILTER =================

  if (energy < 2000) {

    energy = 0;
  }

  // ================= FFT =================

  FFT.windowing(
    FFT_WIN_TYP_HAMMING,
    FFT_FORWARD
  );

  FFT.compute(FFT_FORWARD);

  FFT.complexToMagnitude();

  double maxVal = 0;

  int maxIndex = 0;

  for (int i = 2; i < SAMPLES / 2; i++) {

    if (vReal[i] > maxVal) {

      maxVal = vReal[i];

      maxIndex = i;
    }
  }

  double freq =
    (maxIndex * SAMPLING_FREQUENCY) / SAMPLES;

  // ================= FAKE FREQUENCY FILTER =================

  if (energy == 0 || maxVal < 50) {

    freq = 0;
  }

  // =====================================================
  // ================= VIBRATION =========================
  // =====================================================

  int vibrationCount = 0;

  unsigned long vibStart = millis();

  while (millis() - vibStart < 200) {

    if (digitalRead(VIB_PIN) == HIGH) {

      vibrationCount++;

      delay(1);
    }
  }

  int vibrationIntensity = vibrationCount;

  // remove tiny noise

  if (vibrationIntensity < 3) {

    vibrationIntensity = 0;
  }

  // =====================================================
  // ================= CURRENT SENSOR ====================
  // =====================================================

  // -------- MULTI SAMPLE AVERAGING --------

  long sumRaw = 0;

  for (int i = 0; i < 50; i++) {

    sumRaw += adc1_get_raw(CURRENT_CHANNEL);

    delay(1);
  }

  int currentRaw = sumRaw / 50;

  // =====================================================
  // ================= ZERO CALIBRATION ==================
  // =====================================================

  if (!calibrated) {

    Serial.println("🔄 Zero Calibrating...");
    Serial.println("⚠️ KEEP MOTOR OFF");

    long zeroSum = 0;

    for (int i = 0; i < 500; i++) {

      zeroSum +=
        adc1_get_raw(CURRENT_CHANNEL);

      delay(2);
    }

    baseline = zeroSum / 500;

    calibrated = true;

    Serial.print("✅ Baseline: ");

    Serial.println(baseline);

    return;
  }

  // =====================================================
  // ================= CURRENT CALCULATION ===============
  // =====================================================

  float voltage =
    (currentRaw - baseline)
    * (3.3 / 4095.0);

  // ACS712 10A
  float current = voltage / 0.100;

  // reverse current fix
  current = abs(current);

  // remove tiny noise
  if (current < 0.08) {

    current = 0;
  }

  // =====================================================
  // ================= STALL DETECTION ===================
  // =====================================================

  bool overload = false;

  if (current > 1.5) {

    overload = true;
  }

  // =====================================================
  // ================= SERIAL OUTPUT =====================
  // =====================================================

  Serial.println("================================");

  Serial.print("📟 DEVICE ID: ");
  Serial.println(DEVICE_ID);

  Serial.print("🔊 Sound Energy: ");
  Serial.println(energy);

  Serial.print("🎯 Frequency (Hz): ");
  Serial.println(freq);

  Serial.print("📳 Vibration Intensity: ");
  Serial.println(vibrationIntensity);

  Serial.print("⚡ Current (A): ");
  Serial.println(current);

  if (overload) {

    Serial.println(
      "🚨 MOTOR OVERLOAD / STALL DETECTED"
    );
  }
  else {

    Serial.println(
      "✅ MOTOR NORMAL"
    );
  }

  Serial.println("================================");

  // =====================================================
  // ================= SERVER DATA SEND ==================
  // =====================================================
  String vibStatus = (vibrationIntensity > 0) ? "DETECTED" : "NORMAL";
  sendDataToServer((float)energy, (float)freq, vibStatus, current);

  delay(1000);
}