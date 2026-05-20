#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <driver/i2s.h>
#include <driver/adc.h>
#include <arduinoFFT.h>

// -------- CONFIGURATION --------
#define WIFI_SSID          "WIFI"
#define WIFI_PASSWORD      "passWord"
#define SERVER_URL         "http://192.168.0.108:5000/api/data"
#define DEVICE_ID          "ESP32-01"

// -------- MIC --------
#define I2S_WS 25
#define I2S_SD 33
#define I2S_SCK 26

// -------- SENSORS --------
#define VIB_PIN 27
#define CURRENT_CHANNEL ADC1_CHANNEL_6   // GPIO34

// -------- FFT --------
#define SAMPLES 128
#define SAMPLING_FREQUENCY 16000

double vReal[SAMPLES];
double vImag[SAMPLES];
ArduinoFFT<double> FFT(vReal, vImag, SAMPLES, SAMPLING_FREQUENCY);

int32_t samples[SAMPLES];

// -------- CURRENT CALIBRATION --------
int baseline = 0;
bool calibrated = false;

// ==================== WIFI =============================
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
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

// ==================== SEND DATA ========================
void sendDataToServer(float soundEnergy, float frequency, String vibrationDetected, float current) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["deviceId"] = DEVICE_ID;
    doc["soundEnergy"] = soundEnergy;
    doc["frequency"] = frequency;
    doc["vibration"] = vibrationDetected;
    doc["current"] = current;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
      Serial.print("🌐 HTTP Response code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("❌ HTTP Error code: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("❌ WiFi Disconnected");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("🚀 System Starting...");

  connectWiFi();

  pinMode(VIB_PIN, INPUT);

  // ADC CONFIG (SAFE)
  adc1_config_width(ADC_WIDTH_BIT_12);
  adc1_config_channel_atten(CURRENT_CHANNEL, ADC_ATTEN_DB_11);

  // I2S CONFIG
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLING_FREQUENCY,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_I2S,
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

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);

  Serial.println("✅ Setup Complete");
}

void loop() {

  // ================= MIC =================
  size_t bytes_read;
  i2s_read(I2S_NUM_0, samples, sizeof(samples), &bytes_read, portMAX_DELAY);

  double energy = 0;

  for (int i = 0; i < SAMPLES; i++) {
    vReal[i] = samples[i] / 10000.0;
    vImag[i] = 0;
    energy += abs(vReal[i]);
  }

  FFT.windowing(FFT_WIN_TYP_HAMMING, FFT_FORWARD);
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

  double freq = (maxIndex * SAMPLING_FREQUENCY) / SAMPLES;

  // ================= VIBRATION =================
  int vib = digitalRead(VIB_PIN);
  String vibStatus = vib ? "DETECTED" : "NORMAL";

  // ================= CURRENT =================
  int currentRaw = adc1_get_raw(CURRENT_CHANNEL);

  // -------- CALIBRATION --------
  if (!calibrated) {
    Serial.println("🔄 Calibrating Current Sensor (NO LOAD!)");

    long sum = 0;
    for (int i = 0; i < 200; i++) {
      sum += adc1_get_raw(CURRENT_CHANNEL);
      delay(5);
    }

    baseline = sum / 200;
    calibrated = true;

    Serial.print("✅ Baseline: ");
    Serial.println(baseline);
    return;
  }

  // -------- CURRENT CALCULATION --------
  float voltage = (currentRaw - baseline) * (3.3 / 4095.0);
  float current = voltage / 0.066;   // 30A sensor

  // -------- OFFSET CORRECTION --------
  current = current + 0.5;   // adjust if needed

  // -------- NOISE FILTER --------
  if (abs(current) < 0.3) {
    current = 0;
  }

  // ================= OUTPUT =================
  Serial.println("-------------");

  Serial.print("🔊 Sound Energy: ");
  Serial.println(energy);

  Serial.print("🎯 Frequency: ");
  Serial.println(freq);

  Serial.print("📳 Vibration: ");
  Serial.println(vibStatus);

  Serial.print("⚡ Current (A): ");
  Serial.println(current);

  // ================= HTTP SEND =================
  sendDataToServer((float)energy, (float)freq, vibStatus, current);

  delay(1000);
}
