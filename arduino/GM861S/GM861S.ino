#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h> 

#define WIFI_SSID "Putok ni Nayeon"
#define WIFI_PASSWORD "jihyodorant"
// Pointing to your local Python server IP
#define SERVER_URL "http://172.20.10.2:8000/api/verify" 

#define RED_PIN     D1
#define GREEN_PIN   D2
#define Green_PIN   D3

#define SCANNER_RX  D5
#define SCANNER_TX  D6

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* serverURL = SERVER_URL;

// Helper function to set analog values
void setColor(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(Green_PIN, b);
}

// Fixed colorMap to call setColor directly without returning void
void colorMap(String color) {
  if (color == "Red") {
    setColor(1023, 0, 0);
  } else if (color == "Orange") {
    setColor(1023, 50, 0);
  } else if (color == "Yellow") {
    setColor(512, 1023, 0);
  } else if (color == "Green") {
    setColor(0, 1023, 0);
  } else if (color == "Green") {
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
  pinMode(Green_PIN, OUTPUT);

  Serial.println();
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    colorMap("White"); 
    delay(500);
    colorMap("Off");   
  }

  Serial.println("\nWiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  colorMap("Green"); // Success beep/flash
  delay(2000);
  colorMap("Green");  // Default to Idle state
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

      // Indicate Processing state
      colorMap("Yellow"); 

      // Send to Python server
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

    // Use ArduinoJson to properly escape the QR payload (which is itself JSON)
    JsonDocument doc;
    doc["qr_data"] = qrPayload;
    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);

    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Backend says: " + response);

      // Parse the JSON response from Python
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, response);

      if (!error) {
        String ledCommand = doc["led"].as<String>();
        
        colorMap(ledCommand);
        
        // Wait 3 seconds to show the result, then go back to Idle
        delay(3000);
        colorMap("Green");

      } else {
        Serial.println("Failed to parse JSON response.");
        colorMap("Red");
        delay(3000);
        colorMap("Green");
      }
    } else {
      Serial.println("HTTP POST Failed.");
      colorMap("Red");
      delay(3000);
      colorMap("Green");
    }

    http.end();

  } else {
    Serial.println("WiFi Disconnected");
    colorMap("White");
    setColor(colorMap("White"));
  }
}