// No SoftwareSerial include needed!

#define RED_PIN     25
#define GREEN_PIN   26
#define BLUE_PIN    27

// Using ESP32's dedicated Hardware Serial 2 pins
#define SCANNER_RX 16
#define SCANNER_TX 17

// Create a HardwareSerial object using UART Channel 2
HardwareSerial scanner(2); 

void writeRGB(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}

void setColor(String color) {
  if (color == "Red") {
    writeRGB(255, 0, 0);
  } else if (color == "Orange") {
    writeRGB(255, 40, 0);
  } else if (color == "Yellow") {
    writeRGB(200, 200, 0);
  } else if (color == "Green") {
    writeRGB(0, 255, 0);
  } else if (color == "Blue") {
    writeRGB(0, 0, 255);
  } else if (color == "Pink") {
    writeRGB(255, 50, 100);
  } else if (color == "Cyan") {
    writeRGB(0, 17, 150);
  } else if (color == "White") {
    writeRGB(175, 175, 175);
  } else if (color == "Off") {
    writeRGB(0, 0, 0);
  } else {
    writeRGB(255, 50, 100); // default to pink for unknown colors
  }
}

void setup() {
  // Serial Monitor Baud Rate
  Serial.begin(115200); 
  
  // ESP32 HardwareSerial Initialization: (Baud, Protocol, RX Pin, TX Pin)
  scanner.begin(9600, SERIAL_8N1, SCANNER_RX, SCANNER_TX);
  
  delay(1000);
  Serial.println("\n--- GM861S QR Scanner Ready ---");
  setColor("Green");
}

void loop() {
  if (scanner.available()) {
    setColor("Pink");
    String data = "";
    unsigned long lastByte = millis();
    
    while (millis() - lastByte < 150) {
      if (scanner.available()) {
        char c = scanner.read();
        if (c >= 0x20 && c <= 0x7E) {
          data += c;
        }
        lastByte = millis();
      }
    }
    
    if (data.length() > 0) {
      Serial.println(data);
      setColor("Blue");
      delay(1000);
      setColor("Green");
    }
  }
}