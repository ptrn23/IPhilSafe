#include <SoftwareSerial.h>

// GM861S Pin 5 (TXD) -> D5, GM861S Pin 4 (RXD) -> D6
#define SCANNER_RX D5
#define SCANNER_TX D6
#define BUTTON_PIN D7

SoftwareSerial scanner(SCANNER_RX, SCANNER_TX);

bool reading = false;

void setup() {
  Serial.begin(115200);
  scanner.begin(9600);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  delay(1000);
  Serial.println("\n--- GM861S QR Scanner Ready ---");
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    if (!reading) {
      reading = true;
      // Flush any stale data in the buffer
      while (scanner.available()) scanner.read();
    }

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
      }
    }
  } else {
    reading = false;
    // Discard any data when not triggered
    while (scanner.available()) scanner.read();
  }
}
