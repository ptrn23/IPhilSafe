#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h> 

#define WIFI_SSID "Putok ni Nayeon"
#define WIFI_PASSWORD "jihyodorant"
#define SERVER_URL "https://iphilsafe.vercel.app/" 

#define RED_PIN     D1
#define GREEN_PIN   D2
#define BLUE_PIN    D3

#define SCANNER_RX  D5
#define SCANNER_TX  D6

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* serverURL = SERVER_URL;

void setColor(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}
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
  } else if (color == "Pink") {
    setColor(400, 100, 100);
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

  colorMap("Green"); // wifi success
  delay(1000);
}

void loop() {
  if (scanner.available()) {
    colorMap("Yellow"); // processing qr scanned
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

      sendScanToServer(scannedData);
    }
  }
  else{
    colorMap("Green");
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

      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, response);

      if (!error) {
        String ledCommand = doc["led"].as<String>();
        
        colorMap(ledCommand);
        delay(200);
        colorMap("Off");
        delay(200);
        colorMap(ledCommand);
        delay(1000);
        colorMap("Green");

      } else {
        Serial.println("Failed to parse JSON response.");
        colorMap("Red");
        delay(3000);
        colorMap("Green");
      }
    } else {
      Serial.println("HTTP POST Failed.");
      colorMap("White");
      delay(200);
      colorMap("Off");
      delay(200);
      colorMap("White");
      delay(200);
      colorMap("Off");
      delay(200);
      colorMap("White");
      delay(200);
      colorMap("Green");
    }

    http.end();

  } else {
    Serial.println("WiFi Disconnected");
    colorMap("White");
  }
}