void connectToWiFi() {
  WiFi.begin(ssid, password);

  Serial.print("[Network] Connecting to WiFi: ");

  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    setColor("White"); 
    delay(500);
    setColor("Off");
    delay(300);
  }

  Serial.println("\n[Network] SUCCESS! Connected to WiFi.");
  Serial.print("[Network] Wemos IP Address: ");
  Serial.println(WiFi.localIP());

  flashColor("Green", 3, 200); // wifi success
  setColor(currentColor);
}

String sendApiRequest(String endpoint, String payload) {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String fullUrl = String(serverURL) + endpoint;

  Serial.print("[Network] Target URL: ");
  Serial.println(fullUrl);
  Serial.print("[Network] Payload:    ");
  Serial.println(payload);

  http.begin(client, fullUrl);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(payload);

  Serial.println("[Network] HTTP Code: " + String(httpResponseCode));

  String response = "";

  if (httpResponseCode == 200) {
    response = http.getString();
    Serial.println("[Network] Response: " + response);
    return response;
  }

  else if (httpResponseCode > 0) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, http.getString());

    if (!error) {
      String errorMessage = error ? "Unknown error" : doc["error"].as<String>();
      Serial.println("[Network] ERROR: " + errorMessage);
      flashColor("Red", 2, 300);
      setColor(currentColor);
    }
    else{
      Serial.println("[Network] ERROR: Failed to parse error response JSON");
      flashColor("Pink", 2, 300); // JSON response error color
      setColor(currentColor);
    }
  } 
  else {
    Serial.println("[Network] ERROR: Connection Refused or Failed to reach server");
    flashColor("White", 2, 300); // network error
    setColor(currentColor);
  }

  http.end();
  return "";
}

String createJSONPayload(String qr_data = "") {
  JsonDocument doc;
  doc["locker_id"] = locker_id;
  doc["qr_data"] = qr_data;
  doc["weight"] = currentWeight;
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  return jsonPayload;
}

String sendGetStatus() {
  Serial.println("\n----------------------- GET STATUS HTTP REQUEST -----------------------");
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/get-status", payload);
  Serial.println("-----------------------------------------------------------------------\n");

  if (response != "") {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      String lockerStatus = doc["status"].as<String>();
      return lockerStatus;
    } else {
      Serial.println("[Network] ERROR: Failed to parse error response JSON");
      flashColor("Pink", 2, 300); 
      setColor(currentColor);
    }
  }
  return currentState; // return current state if failed to get status from server
}

void sendStartRegister() {
  Serial.println("\n---------------------- START REGISTER HTTP REQUEST -----------------------");
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/start-reg", payload);
  Serial.println("--------------------------------------------------------------------------\n");

  if (response != "") {
    Serial.println("[Locker] Switched to REGISTER mode");
    lastStartRegisterTime = millis();
    setColor("Yellow"); // register color
  }
}

void sendFinishRegister() {
  Serial.println("\n---------------------- FINISH REGISTER HTTP REQUEST -----------------------");
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/finish-reg", payload);
  Serial.println("---------------------------------------------------------------------------\n");
  
  if (response != "") {
    Serial.println("[Locker] Registration successful. Switching to OCCUPIED mode.");
    flashColor("Yellow", 2, 300); // register finish success
    setColor("Blue"); // switch to occupied
    openLocker();
  }
}

void sendQRAddUser(String qrPayload) {
  Serial.println("\n---------------------- ADD USER HTTP REQUEST -----------------------");
  String payload = createJSONPayload(qrPayload);
  String response = sendApiRequest("/api/locker/add-user", payload);
  Serial.println("--------------------------------------------------------------------\n");

  if (response != "") {
    Serial.println("[Locker] User added successfully.");
    flashColor("Green", 2, 300); // success color
    setColor("Yellow"); // register color
  }
}

void sendOpenLocker(String qrPayload) {
  Serial.println("\n---------------------- OPEN LOCKER HTTP REQUEST -----------------------");
  String payload = createJSONPayload(qrPayload);
  String response = sendApiRequest("/api/locker/open-locker", payload);
  Serial.println("-----------------------------------------------------------------------\n");

  if (response != "") {
    JsonDocument doc;
    deserializeJson(doc, response);
    
    if (doc["message"].as<String>() == "Authorized") {
      Serial.println("[Locker] Access Granted. Opening locker...");
      flashColor("Green", 2, 300); // Authorized
      setColor(currentColor);
      openLocker();
    } else {
      Serial.println("[Locker] Access Denied.");
      flashColor("Red", 2, 300); // Denied
      setColor(currentColor);
    }
  }
}

void sendClosedLocker() {
  Serial.println("\n---------------------- CLOSE LOCKER HTTP REQUEST -----------------------");
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/close-locker", payload);
  Serial.println("------------------------------------------------------------------------\n");

  if (response != "") {
    Serial.println("[Locker] Close locker event sent to server.");
  }
}

void sendUnregister(String qrPayload) {
  Serial.println("\n---------------------- UNREGISTER HTTP REQUEST -----------------------");
  String payload = createJSONPayload(qrPayload);
  String response = sendApiRequest("/api/locker/unreg", payload);
  Serial.println("----------------------------------------------------------------------\n");
  
  if (response != "") {
    Serial.println("[Locker] Unregistration successful.");
    flashColor("Green", 2, 300); // success color
    setColor("Green"); // idle color
  }
}

void sendUpdateWeight() {
  updateWeight();
  
  Serial.println("\n---------------------- UPDATE WEIGHT HTTP REQUEST -----------------------");
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/update-weight", payload);
  Serial.println("-------------------------------------------------------------------------\n");
  
  if (response != "") {
    Serial.println("[Locker] Weight updated successfully.");
  }
}