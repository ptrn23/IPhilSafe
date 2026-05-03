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
  // setColor(1023, 0, 0);       // Red
  // delay(1000);

  // setColor(1023, 50, 0);      // Orange 
  // delay(1000);

  // setColor(700, 400, 0);     // Yellow 
  // delay(1000);
  
  // setColor(0, 1023, 0);       // Green 
  // delay(1000);
  
  // setColor(0, 0, 100);        // Blue
  // delay(1000);
  
  // setColor(100, 200, 100);    // White 
  // delay(1000);

  // setColor(400,100,100);        // Pink
  // delay(1000);

  setColor(0,500,70);        // Cyan
  delay(1000);
}
// Helper function to easily set colors
void setColor(int redValue, int greenValue, int blueValue) {
  analogWrite(redPin, redValue);
  analogWrite(greenPin, greenValue);
  analogWrite(bluePin, blueValue);
}