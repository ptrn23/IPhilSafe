// --- PIN DEFINITIONS ---
#define DOOR_SENSOR_PIN   D7
#define BUTTON_PIN        D9
#define LOCK_PIN          D1
#define DEBUG_LED_PIN     D2  // Added for visual debugging without the monitor

// Variable to remember the last state of the door to prevent Serial Monitor spam
int lastDoorState = -1; 

void setup() {
  Serial.begin(115200);
  delay(1000); // Give the Serial Monitor a second to wake up
  
  digitalWrite(LOCK_PIN, HIGH); // HIGH = Relay OFF = Spring pushed out (LOCKED)
  // 1. Setup the Lock (Must start HIGH to turn an Active-Low relay OFF)
  pinMode(LOCK_PIN, OUTPUT);

  
  // 2. Setup the Sensors (Using internal pull-up resistors)
  pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // 3. Setup the Debug LED
  pinMode(DEBUG_LED_PIN, OUTPUT);
  
  Serial.println("\n--- IPhilSafe Lock & Visual Sensor Test Initialized ---");
}

void loop() {
  // ==========================================
  // 1. BUTTON & LOCK LOGIC
  // ==========================================
  // Because we use INPUT_PULLUP, a pressed button reads as LOW
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("Button Pressed! Popping the lock...");
    
    digitalWrite(LOCK_PIN, LOW);  // LOW = Relay ON = Magnet pulls latch in (UNLOCKED)
    delay(500);                   // Hold for 0.5 seconds
    digitalWrite(LOCK_PIN, HIGH); // HIGH = Relay OFF = Spring pushes latch back out (LOCKED)
    
    Serial.println("Lock power deactivated.");
    delay(500); 
  }

  // ==========================================
  // 2. DOOR SENSOR TRACKING (VISUAL & SERIAL)
  // ==========================================
  int currentDoorState = digitalRead(DOOR_SENSOR_PIN);
  
  // --- VISUAL DEBUG (Instant Update) ---
  if (currentDoorState == LOW) {
    // Switch is PRESSED (Door is securely closed)
    digitalWrite(DEBUG_LED_PIN, LOW);   // Turn Warning LED OFF
  } else { 
    // Switch is RELEASED (Door is open)
    digitalWrite(DEBUG_LED_PIN, HIGH);  // Turn Warning LED ON
  }
  
  // --- SERIAL DEBUG (Update on Change Only) ---
  if (currentDoorState != lastDoorState) {
    if (currentDoorState == LOW) {
      Serial.println("Status: Locker Door is SECURELY CLOSED.");
    } else { 
      Serial.println("WARNING: Locker Door is OPEN!");
    }
    
    // Update the memory variable
    lastDoorState = currentDoorState;
  }
  
  // Keep background Wi-Fi processes happy so the ESP8266 doesn't crash
  yield(); 
}