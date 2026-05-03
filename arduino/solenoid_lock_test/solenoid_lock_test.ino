// Define the relay pin based on your Wemos D1 R1 master pin map
#define RELAY_PIN D10

void setup() {
  // Initialize the serial monitor for debugging
  Serial.begin(115200);
  
  // Set the relay pin as an output
  pinMode(RELAY_PIN, OUTPUT);
  
  // CRITICAL: Ensure the lock starts in the CLOSED (LOW) position
  digitalWrite(RELAY_PIN, LOW); 
  
  // Give the board a second to settle before starting
  delay(1000);
  Serial.println("\n--- Solenoid Lock Test Initialized ---");
  Serial.println("Status: LOCKED");
  delay(2000);
}

void loop() {
  // 1. OPEN THE LOCK
  Serial.println("Triggering Unlock (Relay HIGH)...");
  digitalWrite(RELAY_PIN, HIGH);
  
  // Hold the lock open for 3 seconds
  delay(3000); 
  
  // 2. CLOSE THE LOCK
  Serial.println("Powering off magnet (Relay LOW)...");
  digitalWrite(RELAY_PIN, LOW);
  
  // Keep it locked for 5 seconds before repeating
  delay(5000); 
}
