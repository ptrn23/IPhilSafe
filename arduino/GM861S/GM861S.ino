#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h> 

#define RED_PIN     D1
#define GREEN_PIN   D2
#define BLUE_PIN    D3

#define SCANNER_RX  D5
#define SCANNER_TX  D6

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverURL = "http://YOUR_BACKEND_IP_OR_URL/api/verify";

void colorMap(String color) {
  if (color == "Red") {
    setColor(1023, 0, 0);
  } else if (color == "Orange") {
    setColor(1023, 50, 0);
  } else if (color == "Yellow") {
    setColor(512, 1023, 0);
  } else if (color == "Green") {
    setColor(0, 1023, 0);
  } else if (color == "Blue") {
    setColor(0, 0, 100);
  } else if (color == "White") {
    setColor(100, 200, 100);
  } else if (color == "Off") {
    setColor(0, 0, 0);
  }
}

SoftwareSerial scanner(SCANNER_RX, SCANNER_TX); 

String lastScannedCode = "";
unsigned long lastScanTime = 0;
const unsigned long duplicateTimeout = 5000;

void setup() {
  Serial.begin(115200);
  scanner.begin(9600); 
  delay(1000);
  Serial.println("\n--- GM861S QR Scanner Ready ---");

  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  Serial.println();
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    setColor(colorMap("White"));
    delay(500);
    setColor(colorMap("Off"));
  }

  Serial.println("\nWiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  setColor(colorMap("Green"));
}

void loop() {
  if (scanner.available()) {
    String scannedData = "";
    unsigned long lastByte = millis();
    while (millis() - lastByte < 150) {
      if (scanner.available()) {
        char c = scanner.read();
        if (c >= 0x20 && c <= 0x7E) {
          scannedData += c;
        }
        lastByte = millis();
      }
    }

    if (scannedData.length() > 0) {
      if (scannedData == lastScannedCode && (millis() - lastScanTime < duplicateTimeout)) {
        Serial.println("Duplicate scan ignored.");
        return; 
      }

      Serial.println("QR Scanned: " + scannedData);
      lastScannedCode = scannedData;
      lastScanTime = millis();

      setColor(colorMap("Yellow"));

      sendScanToServer(scannedData);
    }
  }
}

void sendScanToServer(String qrPayload) {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;

    Serial.print("Sending POST request to: ");
    Serial.println(serverURL);

    http.begin(client, serverURL);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"qr_data\":\"" + qrPayload + "\"}";
    int httpResponseCode = http.POST(jsonPayload);

    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);

    http.end();
    
  } else {
    Serial.println("WiFi Disconnected");
    setColor(colorMap("White"));
    return -1;
  }
}

void setColor(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}