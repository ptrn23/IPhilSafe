// Define the pins for the ESP8266
#define RED_PIN     25 
#define GREEN_PIN   26 
#define BLUE_PIN    27 

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
}

void loop() {
  setColor(255, 0, 0);       // Red
  delay(1000);

  setColor(255, 40, 0);      // Orange 
  delay(1000);

  setColor(200, 200, 0);     // Yellow 
  delay(1000);
  
  setColor(0, 255, 0);       // Green 
  delay(1000);
  
  setColor(0, 0, 255);        // Blue
  delay(1000);
  
  setColor(175, 175, 175);    // White
  delay(1000);

  setColor(255, 50, 100);     // Pink
  delay(1000);

  setColor(0, 175, 175);      // Cyan
  delay(1000);
}
// Helper function to easily set colors
void setColor(int redValue, int greenValue, int blueValue) {
  analogWrite(RED_PIN, redValue);
  analogWrite(GREEN_PIN, greenValue);
  analogWrite(BLUE_PIN, blueValue);
}