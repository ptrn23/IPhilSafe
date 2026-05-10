const int calVal_eepromAdress = 0;

void setupWeightSensor() {
  Serial.println("[HX711] Initializing Weight Sensor...");
  
  EEPROM.begin(512);
  float calibrationValue = 0.0;
  EEPROM.get(calVal_eepromAdress, calibrationValue);
  
  Serial.print("[HX711] Loaded calibration value from EEPROM: ");
  Serial.println(calibrationValue);

  LoadCell.begin();

  float stabilizationTime = 3000; 
  boolean _tare = true; 
  LoadCell.start(stabilizationTime, _tare);

  if (LoadCell.getTareTimeoutFlag() || LoadCell.getSignalTimeoutFlag()) {
    Serial.println("[HX711] Weight Sensor Error: Check MCU>HX711 wiring.");
    while (1) {
      Serial.println("[HX711] Weight Sensor Error: Check MCU>HX711 wiring.");
      yield(); // Feed the watchdog timer to prevent crashes
    }
  } else {
    LoadCell.setCalFactor(calibrationValue);
    Serial.println("[HX711] Weight Sensor Setup Complete.");
  }
}

void updateWeight() {
  currentWeight = LoadCell.getData();
  lastWeightCheck = millis();
  
  Serial.print("[HX711] Weight Updated: ");
  Serial.print(currentWeight);
  Serial.println(" g");
}