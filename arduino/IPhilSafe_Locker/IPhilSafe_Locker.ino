#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <HX711_ADC.h>
#include <EEPROM.h>

#define WIFI_SSID     "Putok ni Nayeon"
#define WIFI_PASSWORD "jihyodorant"
#define SERVER_URL    "https://iphilsafe.vercel.app" //  "http://172.20.10.4:3000"// 

#define RED_PIN           25
#define GREEN_PIN         26
#define BLUE_PIN          27

#define HX711_DT_PIN      32
#define HX711_SCK_PIN     33

#define SCANNER_RX        16
#define SCANNER_TX        17

#define LOCK_PIN          14
#define DOOR_SENSOR_PIN   4
#define BUTTON_PIN        5
#define DEBUG_LED_PIN     13

String currentState = "";
String currentColor = "White";

const int locker_id = 2;

int lastDoorState = HIGH;
unsigned long lastDoorClosed = 0;

int currentWeight = 0;
unsigned long lastWeightCheck = 0;
const unsigned long weightCheckInterval = 60000; // check weight every 60 seconds

String lastScannedCode = "";
unsigned long lastScanTime = 0;
const unsigned long duplicateTimeout = 5000;

unsigned long lastStartRegisterTime = 0;
const unsigned long registerModeTimeout = 30000; // 30 secons to complete registration

const unsigned long unregisterModeTimeout = 30000; // 30 seconds to complete unregistration
unsigned long lastUnregisterTime = 0;


const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* serverURL = SERVER_URL;

HardwareSerial scanner(2);
HX711_ADC LoadCell(HX711_DT_PIN, HX711_SCK_PIN);

void setup() {
  Serial.begin(115200);
  scanner.begin(9600, SERIAL_8N1, SCANNER_RX, SCANNER_TX);

  Serial.println("\n\n=======================================");
  Serial.println("   IPHILSAFE LOCKER TERMINAL STARTED   ");
  Serial.println("=======================================\n");
  
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  pinMode(LOCK_PIN, OUTPUT);
  digitalWrite(LOCK_PIN, HIGH);
  pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  delay(1000);
  
  setColor("White");
  setupWeightSensor();
  connectToWiFi();

  Serial.println("[Locker] Locker setup complete.");
  updateCurrentState();
}

void updateCurrentState() {
  currentState = sendGetStatus();
  currentColor = statusToLED(currentState);
  setColor(currentColor);
}

void openLocker() {
  if (isDoorOpen()) {
    Serial.println("[Locker] Locker is already open.");
    return;
  }
  
  while (!isDoorOpen()) {
    digitalWrite(LOCK_PIN, LOW); // Unlock
    delay(500); // Keep unlocked for 0.5 seconds
    digitalWrite(LOCK_PIN, HIGH); // Lock back
    delay(500);
  }
  Serial.println("[Locker] Locker opened successfully.");
}

bool isDoorOpen() {
  int doorState = digitalRead(DOOR_SENSOR_PIN);
  if (doorState == HIGH) { // door opened
    return true;
  }
  return false;
}

void loop() {
  LoadCell.update();

  if (currentState == "IDLE") {
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { // new qr scanned, switch to register mode
      Serial.println("[Locker] QR code scanned for user registration. Switching to REGISTER mode.");
      sendStartRegister();
      updateCurrentState(); // expected to switch to REGISTER
      sendQRAddUser(qr_scanned);
    }

    if (digitalRead(BUTTON_PIN) == LOW) { // button pressed, switch to register mode
      Serial.println("[Locker] Register button pressed. Switching to REGISTER mode.");
      sendStartRegister();
      updateCurrentState();
      while(digitalRead(BUTTON_PIN) == LOW) { delay(10); }
    }
  } 
  
  else if (currentState == "REGISTER") {
    if (millis() - lastStartRegisterTime > registerModeTimeout) { // registration timeout, switch back to idle
      Serial.println("[Locker] Registration timeout. Switching back to IDLE mode.");
      sendFinishRegister();
      updateCurrentState();
    }
    
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { // new qr scanned, try to add user
      Serial.println("[Locker] QR code scanned for user registration.");
      sendQRAddUser(qr_scanned);
      updateCurrentState();
    }

    if (digitalRead(BUTTON_PIN) == LOW) { // button pressed, end register mode
      Serial.println("[Locker] Register button pressed. Finishing registration.");
      sendFinishRegister();
      updateCurrentState();
      while(digitalRead(BUTTON_PIN) == LOW) { delay(10); }
    }
  } 
  
  else if (currentState == "OCCUPIED") {
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { // new qr scanned, try open locker
      Serial.println("[Locker] QR code scanned for locker access.");
      sendOpenLocker(qr_scanned);
      updateCurrentState();
    }

    if (lastDoorState == HIGH && !isDoorOpen() && millis() - lastDoorClosed > 300) { // door just closed
      Serial.println("[Locker] Door closed. Updating weight and locker status.");
      updateWeight();
      sendClosedLocker();
      updateCurrentState();
    }

    if (!isDoorOpen()) { // door is closed
      if (digitalRead(BUTTON_PIN) == LOW) { // button pressed, verify weight, unregister
        Serial.println("[Locker] Unregister button pressed. Switching to UNREGISTER mode.");
        currentState = "UNREGISTER";
        setColor("Orange"); // unregister color
        lastUnregisterTime = millis();
        while(digitalRead(BUTTON_PIN) == LOW) { delay(10); }
      }

      if (millis() - lastWeightCheck >= weightCheckInterval) {
        sendUpdateWeight();
      }
    }
  } 
  
  else if (currentState == "UNREGISTER") {
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { // unregister with scanned qr
      Serial.println("[Locker] QR code scanned for unregister.");
      sendUnregister(qr_scanned);
      updateCurrentState();
    }

    if (millis() - lastUnregisterTime > unregisterModeTimeout) { // unregister timeout, switch back to occupied
      Serial.println("[Locker] Unregister mode timeout. Switching back to OCCUPIED mode.");
      currentState = "OCCUPIED";
      setColor("Blue");
      updateCurrentState();
    }
    
    if (digitalRead(BUTTON_PIN) == LOW) { // button pressed, undo unregister
      Serial.println("[Locker] Unregister button pressed. Switching back to OCCUPIED mode.");
      currentState = "OCCUPIED";  
      setColor("Blue");
      updateCurrentState();
      while(digitalRead(BUTTON_PIN) == LOW) { delay(10); }
    }
  } 
  
  else if (currentState == "TAMPERED") {
    setColor("Red"); // forever red until reset
  }

  lastDoorState = digitalRead(DOOR_SENSOR_PIN);
}