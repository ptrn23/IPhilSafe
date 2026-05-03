#include <SoftwareSerial.h>

#define RED_PIN     D1
#define GREEN_PIN   D2
#define BLUE_PIN   D3

#define SCANNER_RX D5
#define SCANNER_TX D6

SoftwareSerial scanner(SCANNER_RX, SCANNER_TX);

void setColor(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}

void colorMap(String color) {
  if (color == "Red") {
    setColor(1023, 0, 0);
  } else if (color == "Orange") {
    setColor(1023, 50, 0);
  } else if (color == "Yellow") {
    setColor(512, 1023, 0);
  } else if (color == "Green") {
    setColor(0, 1023, 0);
  } else if (color == "Blue") {
    setColor(0, 0, 100);
  } else if (color == "White") {
    setColor(100, 200, 100);
  } else if (color == "Off") {
    setColor(0, 0, 0);
  }
}

void setup() {
  colorMap("White");
  Serial.begin(115200);
  scanner.begin(9600);
  delay(1000);
  Serial.println("\n--- GM861S QR Scanner Ready ---");
  colorMap("Green");

}

void loop() {
  if (scanner.available()) {
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
      colorMap("Yellow");
      delay(1000);
      colorMap("Green");
    }
  }
}
