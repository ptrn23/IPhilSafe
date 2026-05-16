#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <HX711_ADC.h>
#include <EEPROM.h>

#define WIFI_SSID     "Putok ni Nayeon"
#define WIFI_PASSWORD "jihyodorant"
#define SERVER_URL    "https://iphilsafe.vercel.app"

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
int currentWeight = 0;

const int locker_id = 2;

int lastDoorState = -1;
unsigned long lastDoorClosed = 0;

unsigned long lastWeightCheck = 0;
unsigned long weightCheckInterval = 30000; // check weight every 30 seconds

String lastScannedCode = "";
unsigned long lastScanTime = 0;
unsigned long duplicateTimeout = 3000;  // 3 seconds to ignore duplicate scans

unsigned long lastStartRegisterTime = 0;
unsigned long registerModeTimeout = 60000; // 60 seconds to complete registration

unsigned long lastUnregisterTime = 0;
unsigned long unregisterModeTimeout = 60000; // 60 seconds to complete unregistration

unsigned long lastGetStatusTime = 0;
unsigned long getstatusInterval = 10000; // check status every 10 seconds

unsigned long lastGetSettingsTime = 0;
const unsigned long getSettingsInterval = 300000; // get settings every 5 minutes

unsigned long lastTareTime = 0;
const unsigned long tareInterval = 60000; // tare every 1 minute when idle

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* serverURL = SERVER_URL;

HardwareSerial scanner(2);
HX711_ADC LoadCell(HX711_DT_PIN, HX711_SCK_PIN);

volatile bool doorJustClosedFlag = false;
void IRAM_ATTR doorISR() {
  doorJustClosedFlag = true; 
}

volatile bool buttonPressedFlag = false;
volatile unsigned long lastButtonInterruptTime = 0; 
const unsigned long debounceDelay = 500; // 0.5s ignore window to prevent double-clicks
void IRAM_ATTR buttonISR() {
  unsigned long interruptTime = millis();
  // Only trigger if 1000ms have passed since the last trigger
  if (interruptTime - lastButtonInterruptTime > debounceDelay) {
    buttonPressedFlag = true;
    lastButtonInterruptTime = interruptTime;
  }
}

void setup() {
  Serial.begin(115200);
  scanner.begin(9600, SERIAL_8N1, SCANNER_RX, SCANNER_TX);

  delay(1000);

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
  pinMode(DEBUG_LED_PIN, OUTPUT);

  attachInterrupt(digitalPinToInterrupt(DOOR_SENSOR_PIN), doorISR, FALLING);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), buttonISR, FALLING);

  delay(1000);
  
  setColor("White");
  setupWeightSensor();
  connectToWiFi();
  sendGetSettings();
  updateCurrentState();
  Serial.println("[Locker] Locker setup complete.");
}

void updateCurrentState() {
   if (currentState != "UNREGISTER"){
    currentState = sendGetStatus();
    currentColor = statusToLED(currentState);
    setColor(currentColor);
    lastGetStatusTime = millis();
    Serial.println("[Locker] Current locker state: " + currentState);
  }
}

void openLocker() {
  if (isDoorOpen()) {
    Serial.println("[Locker] Locker is already open.");
    return;
  }
  while (!isDoorOpen()) { // try to open locker until door sensor detects it's open
    digitalWrite(LOCK_PIN, LOW);
    delay(500);
    digitalWrite(LOCK_PIN, HIGH);
    delay(500);
  }
  Serial.println("[Locker] Locker opened successfully.");
}

bool isDoorOpen() {
  return digitalRead(DOOR_SENSOR_PIN) == HIGH;
}

void loop() {
  LoadCell.update();

  bool currentDoorOpen = isDoorOpen();
  if (isDoorOpen()){
    digitalWrite(DEBUG_LED_PIN, HIGH);
  } else {
    digitalWrite(DEBUG_LED_PIN, LOW);
  }

  // door just closed
  if (doorJustClosedFlag) {
    doorJustClosedFlag = false;
    delay(50); 
    if (!isDoorOpen()) { 
      Serial.println("[Locker] Door safely closed. Updating server...");
      updateWeight();
      sendClosedLocker();
      updateCurrentState();
    }
  }

  // periodically get settings from server
  if (millis() - lastGetSettingsTime >= getSettingsInterval) {
    sendGetSettings();
  }

  if (currentState == "IDLE") {
    // qr scanned, switch to register mode, try to add user
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { 
      Serial.println("[Locker] QR code scanned for user registration. Switching to REGISTER mode.");
      sendStartRegister();
      sendQRAddUser(qr_scanned);
      updateCurrentState(); // expected to switch to REGISTER
    }

    // button pressed, switch to register mode
    if (buttonPressedFlag) { 
      buttonPressedFlag = false; // Reset the flag immediately
      Serial.println("[Locker] Register button pressed. Switching to REGISTER mode.");
      sendStartRegister();
      updateCurrentState();
    }

    if (millis() - lastTareTime >= tareInterval) {
      if (currentWeight > -30.0 && currentWeight < 20.0) {
        Serial.println("[Locker] Performing 1-minute background tare...");
        tareWeight();
      } else {
        Serial.println("[Locker] Tare skipped: Weight out of drift range.");
      }

      tareWeight();
      lastTareTime = millis();
    }
  } 
  
  else if (currentState == "REGISTER") {
    // registration timeout, switch back to idle
    if (millis() - lastStartRegisterTime > registerModeTimeout) {
      Serial.println("[Locker] Registration timeout. Switching back to IDLE mode.");
      sendFinishRegister();
      updateCurrentState();
    }
    
    // qr scanned, try to add user
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { 
      Serial.println("[Locker] QR code scanned for user registration.");
      sendQRAddUser(qr_scanned);
      updateCurrentState();
    }

    // button pressed, end register mode
    if (buttonPressedFlag) { 
      buttonPressedFlag = false;
      Serial.println("[Locker] Register button pressed. Finishing registration.");
      sendFinishRegister();
      updateCurrentState();
    }
  } 
  
  else if (currentState == "OCCUPIED") {
    // qr scanned, try to open locker
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { 
      Serial.println("[Locker] QR code scanned for locker access.");
      sendOpenLocker(qr_scanned);
      updateCurrentState();
    }
    
     // door is currently closed
    if (!isDoorOpen()) {
      // button pressed, switch to unregister mode
      if (buttonPressedFlag) { 
        buttonPressedFlag = false;
        Serial.println("[Locker] Unregister button pressed. Switching to UNREGISTER mode.");
        currentState = "UNREGISTER";
        setColor("Orange"); // unregister color
        lastUnregisterTime = millis();
      }

      if (millis() - lastWeightCheck >= weightCheckInterval) {
        sendUpdateWeight();
        updateCurrentState();
      }
    }
  } 
  
  else if (currentState == "UNREGISTER") {
    // unregister timeout, switch back to occupied
    if (millis() - lastUnregisterTime > unregisterModeTimeout) { 
      Serial.println("[Locker] Unregister mode timeout. Switching back to OCCUPIED mode.");
      currentState = "OCCUPIED";
      setColor("Blue");
      updateCurrentState();
    }
    
    // qr scanned, try to unregister locker
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { 
      Serial.println("[Locker] QR code scanned for unregister.");
      sendUnregister(qr_scanned);
      updateCurrentState();
    }

    // button pressed, undo unregister
    if (buttonPressedFlag) {
      buttonPressedFlag = false;
      Serial.println("[Locker] Unregister button pressed. Switching back to OCCUPIED mode.");
      currentState = "OCCUPIED";  
      setColor("Blue");
      updateCurrentState();
    }
  } 
  
  else if (currentState == "TAMPERED") {
    setColor("Red"); // forever red until reset or admin intervention

    // periodically check locker status from server
    if (millis() - lastGetStatusTime >= getstatusInterval) {
      updateCurrentState();
    }

    // qr scanned, only admin QR can reset tamper state
    String qr_scanned = checkScanner();
    if (qr_scanned.length() > 0) { 
      Serial.println("[Locker] QR code scanned for admin access.");
      sendOpenLocker(qr_scanned);
      updateCurrentState();
    }
  }
}