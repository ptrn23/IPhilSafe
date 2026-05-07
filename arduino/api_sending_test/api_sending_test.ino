#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// --- YOUR NETWORK DETAILS ---
#define WIFI_SSID "Putok ni Nayeon"
#define WIFI_PASSWORD "jihyodorant"
#define SERVER_URL "https://iphilsafe.vercel.app"

const int locker_id = 1;
String dummyQRCode = "TEST_QR_12345"; // Fake QR code for testing

void setup() {
  Serial.begin(115200);
  delay(1000); // Let Serial wake up

  Serial.println("\n\n=======================================");
  Serial.println("   IPHILSAFE API SIMULATOR STARTING   ");
  Serial.println("=======================================");

  // Connect to WiFi
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nSUCCESS! Connected to WiFi.");
  Serial.print("Wemos IP Address: ");
  Serial.println(WiFi.localIP());
  
  printMenu();
}

void loop() {
  // Listen for you to type a number into the Serial Monitor
  if (Serial.available() > 0) {
    char command = Serial.read();
    
    // Ignore newline characters from the enter key
    if (command == '\n' || command == '\r') return; 

    Serial.println("\n---------------------------------------");
    
    if (command == '1') {
      Serial.println(">> SIMULATING: Get Locker Status");
      sendApiRequest("/api/locker/get-status", createJSONPayload(""));
    } 
    else if (command == '2') {
      Serial.println(">> SIMULATING: Start Registration (Button Press)");
      sendApiRequest("/api/locker/start-reg", createJSONPayload(""));
    } 
    else if (command == '3') {
      Serial.println(">> SIMULATING: Add User (Scanned QR)");
      sendApiRequest("/api/locker/add-user", createJSONPayload(dummyQRCode));
    } 
    else if (command == '4') {
      Serial.println(">> SIMULATING: Open Locker (Scanned QR)");
      sendApiRequest("/api/locker/open-locker", createJSONPayload(dummyQRCode));
    } 
    else if (command == '5') {
      Serial.println(">> SIMULATING: Door Closed");
      sendApiRequest("/api/locker/close-locker", createJSONPayload(""));
    }
    else if (command == '6') {
      Serial.println(">> SIMULATING: Unregister (Button Press)");
      sendApiRequest("/api/locker/unreg", createJSONPayload(""));
    }
    else {
      Serial.println("Invalid command.");
    }
    
    delay(1000); // Brief pause before showing the menu again
    printMenu();
  }
}

// --- HELPER FUNCTIONS ---

void printMenu() {
  Serial.println("\n--- SIMULATOR MENU ---");
  Serial.println("Type a number and press Enter:");
  Serial.println("[1] Get Status");
  Serial.println("[2] Start Registration");
  Serial.println("[3] Add User (Sends Dummy QR)");
  Serial.println("[4] Open Locker (Sends Dummy QR)");
  Serial.println("[5] Close Locker");
  Serial.println("[6] Unregister");
  Serial.print("Waiting for command... ");
}

String createJSONPayload(String qr_data) {
  JsonDocument doc;
  doc["locker_id"] = locker_id;
  doc["qr_data"] = qr_data;
  doc["weight"] = 0; // Dummy weight
  
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  return jsonPayload;
}

// The Master HTTP Function (Pure Software)
void sendApiRequest(String endpoint, String payload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("ERROR: WiFi disconnected!");
    return;
  }

  WiFiClientSecure client; 
  client.setInsecure(); // Required so it doesn't reject Vercel's SSL certificate
  HTTPClient http;

  String fullUrl = String(SERVER_URL) + endpoint;
  Serial.print("Target URL: ");
  Serial.println(fullUrl);
  Serial.print("Payload:    ");
  Serial.println(payload);

  http.begin(client, fullUrl);
  http.addHeader("Content-Type", "application/json");

  // Send the POST request
  int httpResponseCode = http.POST(payload);

  Serial.println("--- SERVER RESPONSE ---");
  Serial.print("HTTP Status Code: ");
  Serial.println(httpResponseCode);

  if (httpResponseCode > 0) {
    String responseBody = http.getString();
    Serial.print("Response Body:    ");
    Serial.println(responseBody);
  } else {
    Serial.println("ERROR: Connection Refused or Failed to reach server.");
    Serial.println("Check your Laptop's IP address and Firewall settings!");
  }
  Serial.println("---------------------------------------");
  
  http.end();
}