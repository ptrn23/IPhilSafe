#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h> 

#define WIFI_SSID "Putok ni Nayeon"
#define WIFI_PASSWORD "jihyodorant"
#define SERVER_URL  "https://iphilsafe.vercel.app" //  "http://172.20.10.4:3000"// 

#define RED_PIN           D10
#define GREEN_PIN         D2
#define BLUE_PIN          D3

#define HX711_DT_PIN      D4
#define HX711_SCK_PIN     D0

#define SCANNER_RX        D5
#define SCANNER_TX        D6

#define LOCK_PIN          D1
#define DOOR_SENSOR_PIN   D7
#define BUTTON_PIN        D9

String currentState = "IDLE";
String currentColor = "Green";

int currentWeight = 0;
int lastDoorState = HIGH;

const int locker_id = 1;

unsigned long lastWeightCheck = 0;
const unsigned long weightCheckInterval = 10000; // check weight every 10 seconds

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* serverURL = SERVER_URL;

void writeRGB(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}
void setColor(String color) {
  if (color == "Red") {
    writeRGB(1023, 0, 0);
  } else if (color == "Orange") {
    writeRGB(1023, 50, 0);
  } else if (color == "Yellow") {
    writeRGB(512, 1023, 0);
  } else if (color == "Green") {
    writeRGB(0, 1023, 0);
  } else if (color == "Blue") {
    writeRGB(0, 0, 100);
  } else if (color == "Pink") {
    writeRGB(400, 100, 100);
  } else if (color == "Cyan") {
    writeRGB(0, 500, 70);
  } else if (color == "White") {
    writeRGB(100, 200, 100);
  } else if (color == "Off") {
    writeRGB(0, 0, 0);
  } else {
    writeRGB(400, 100, 100); // default to pink for unknown colors
  }
}

void flashColor(String color, int times, int delayTime) {
  for (int i = 0; i < times; i++) {
    setColor(color);
    delay(delayTime);
    setColor("Off");
    delay(delayTime);
  }
}

SoftwareSerial scanner(SCANNER_RX, SCANNER_TX); 

String lastScannedCode = "";
unsigned long lastScanTime = 0;
const unsigned long duplicateTimeout = 5000;

void connectToWiFi() {
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    setColor("White"); 
    delay(500);
    setColor("Off");
    delay(500);
  }

  flashColor("Green", 3, 200); // wifi success
  setColor(currentColor);
}

void setup() {
  Serial.begin(115200);
  scanner.begin(9600); 
  
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  digitalWrite(LOCK_PIN, HIGH);
  pinMode(LOCK_PIN, OUTPUT);
  pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  delay(1000);

  connectToWiFi();
  updateCurrentState();
}

String statusToLED(String status) {
  if (status == "IDLE") {
    return "Green";
  } else if (status == "OCCUPIED") {
    return "Blue";
  } else if (status == "REGISTER") {
    return "Yellow";
  } else if (status == "TAMPERED") {
    return "Red";
  } else {
    return "Pink"; // default unknown status color
  }
}

String checkScanner() {
  if (scanner.available()) {
    setColor("Cyan"); // qr processing color
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
        setColor(currentColor);
        return ""; // ignore duplicate scan
      }
      lastScannedCode = scannedData;
      lastScanTime = millis();
      return scannedData;
    }
  }
  setColor(currentColor);
  return "";
}

String sendApiRequest(String endpoint, String payload) { // master api request function
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String fullUrl = String(serverURL) + endpoint;
  http.begin(client, fullUrl);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(payload);
  String response = "";

  if (httpResponseCode == 200) {
    response = http.getString();
  } else if (httpResponseCode > 0) {
    if (httpResponseCode == 400) {
      flashColor("Red", 2, 300); // bad request color
    } else if (httpResponseCode == 401) {
      flashColor("Red", 3, 300); // unauthorized color
    } else if (httpResponseCode == 404) {
      flashColor("Red", 4, 300); // not found color
    } else if (httpResponseCode == 409) {
      flashColor("Red", 5, 300); // conflict color
    } else if (httpResponseCode == 500) {
      flashColor("Red", 6, 300); // server error color
    } else {
      flashColor("Pink", 2, 300); // unknown http error color
    }
    setColor(currentColor);
  } else {
    flashColor("White", 2, 300); // network error
    setColor(currentColor);
  }
  
  http.end();
  return response; // return http response 
}

String createJSONPayload(String qr_data = "") {
  JsonDocument doc;
  doc["locker_id"] = locker_id;
  doc["qr_data"] = qr_data;
  doc["weight"] = currentWeight;
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  return jsonPayload;
}

String sendGetStatus() {
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/get-status", payload);

  if (response != "") {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
        String lockerStatus = doc["status"].as<String>();
        return lockerStatus;
    } else {
      flashColor("Pink", 2, 300); // JSON response error color
      setColor(currentColor);
    }
  }
  return currentState; // return current state if failed to get status from server
}

void updateCurrentState() {
  currentState = sendGetStatus();
  currentColor = statusToLED(currentState);
  setColor(currentColor);
}

void updateWeight() {
  // Placeholder for future load cell integration
}

void openLocker() {
  digitalWrite(LOCK_PIN, LOW); // Unlock
  delay(500); // Keep unlocked for 0.5 seconds
  digitalWrite(LOCK_PIN, HIGH); // Lock back
}

void sendStartRegister() {
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/start-reg", payload);

  if (response != "") {
    setColor("Yellow"); // register color
  }
}

void sendFinishRegister() {
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/finish-reg", payload);
  
  if (response != "") {
    flashColor("Blue", 2, 300); // occupied color
  }
}

void sendQRAddUser(String qrPayload) {
  String payload = createJSONPayload(qrPayload);
  String response = sendApiRequest("/api/locker/add-user", payload);

  if (response != "") {
    flashColor("Green", 2, 300); // success color
    delay(500);
    setColor(currentColor);
  }
}

void sendOpenLocker(String qrPayload) {
  String payload = createJSONPayload(qrPayload);
  String response = sendApiRequest("/api/locker/open-locker", payload);

  if (response != "") {
    JsonDocument doc;
    deserializeJson(doc, response);
    
    if (doc["message"].as<String>() == "Authorized") {
      flashColor("Green", 2, 300); // Authorized
      setColor(currentColor);
      openLocker();
    } else {
      flashColor("Red", 2, 300); // Denied
      setColor(currentColor);
    }
  }
}

void sendClosedLocker() {
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/close-locker", payload);
  
  if (response != "") {
    flashColor("Blue", 2, 300); // closed locker blink
    setColor(currentColor);
  }
}

void sendUnregister() {
  setColor("Orange"); // start unregister color
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/unreg", payload);
  
  if (response != "") {
    flashColor("Green", 2, 300); // success color
    setColor(currentColor);
  }
}

void sendUpdateWeight() {
  updateWeight(); // placeholder for future load cell integration
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/update-weight", payload);
  
  if (response != "") {
    // weight updated successfully, no need to flash color
  }
}

bool isDoorOpen() {
  int doorState = digitalRead(DOOR_SENSOR_PIN);
  if (doorState == HIGH) { // door opened
    return true;
  }
  return false;
}

void loop() {
  // // Periodically check weight every 10 seconds
  // if (millis() - lastWeightCheck >= 10000) {
  //   sendUpdateWeight();
  //   lastWeightCheck = millis();
  // }

  if (currentState == "IDLE") {
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { // new qr scanned, switch to register mode
      sendStartRegister();
      updateCurrentState(); // expected to switch to REGISTER
      sendQRAddUser(qr_scanned);
    }
    if (digitalRead(BUTTON_PIN) == LOW) { // button pressed, switch to register mode
      sendStartRegister();
      delay(500);
      updateCurrentState();
      delay(500);
    }

  } else if (currentState == "REGISTER") {
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { // new qr scanned, try to add user
      sendQRAddUser(qr_scanned);
      updateCurrentState();
    }
    if (digitalRead(BUTTON_PIN) == LOW) { // button pressed, end register mode
      sendFinishRegister();
      updateCurrentState();
      delay(500);
    }

  } else if (currentState == "OCCUPIED") {
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { // new qr scanned, try open locker
        sendOpenLocker(qr_scanned);
        updateCurrentState();
    }
    if (lastDoorState == HIGH && !isDoorOpen()) { // door just closed
      sendClosedLocker();
      updateCurrentState();
    }
    if (!isDoorOpen()) { // door closed
      if (digitalRead(BUTTON_PIN) == LOW) { // button pressed, verify weight, unregister
        sendUnregister();
        updateCurrentState();
        delay(500);
      }
    }

  } else if (currentState == "TAMPERED") {
    setColor("Red"); // forever red until reset
  }
  lastDoorState = digitalRead(DOOR_SENSOR_PIN);
}