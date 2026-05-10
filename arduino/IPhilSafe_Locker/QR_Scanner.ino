String checkScanner() {
  if (scanner.available()) {
    setColor("Cyan"); // qr processing color
    String scannedData = "";
    unsigned long lastByte = millis();
    while (millis() - lastByte < 150) {
      if (scanner.available()) {
        char c = scanner.read();
        if (c >= 0x20 && c <= 0x7E) {
          scannedData += c;
        }
        lastByte = millis();
      }
    }

    if (scannedData.length() > 0) {
      if (scannedData == lastScannedCode && (millis() - lastScanTime < duplicateTimeout)) {
        setColor(currentColor);
        return ""; // ignore duplicate scan
      }
      if (!scannedData.startsWith("{") || !scannedData.endsWith("}")) {
        setColor(currentColor);
        return ""; // ignore non-JSON scans
      }
      
      Serial.print("[Scanner] QR Code Scanned: ");
      Serial.println(scannedData);
      
      lastScannedCode = scannedData;
      lastScanTime = millis();
      return scannedData;
    }
  }
  return "";
}