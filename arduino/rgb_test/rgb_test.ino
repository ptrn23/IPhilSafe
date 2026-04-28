// Define the pins for the ESP8266
const int redPin = D1;   
const int greenPin = D2; 
const int bluePin = D3;  

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
}

void loop() {
  // --- IPhilSafe Locker Status Colors ---
  
  setColor(1023, 0, 0);       // Red (Error/Locked)
  delay(1000);

  setColor(1023, 50, 0);     // Orange (Processing/Verifying Weight)
  delay(1000);

  setColor(512, 1023, 0);     // Yellow (Registration Window)
  delay(1000);
  
  setColor(0, 1023, 0);       // Green (Success/Unlocked)
  delay(1000);
  
  setColor(0, 0, 100);       // Blue (Idle/Ready to Scan)
  delay(1000);
  
  setColor(100, 200, 100); // White (All colors ON)
  delay(1000);
}
// Helper function to easily set colors
void setColor(int redValue, int greenValue, int blueValue) {
  analogWrite(redPin, redValue);
  analogWrite(greenPin, greenValue);
  analogWrite(bluePin, blueValue);
}