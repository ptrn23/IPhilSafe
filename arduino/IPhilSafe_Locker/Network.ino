void connectToWiFi() {
  WiFi.begin(ssid, password);

  Serial.print("[Network] Connecting to WiFi: ");

  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    setColor("White"); 
    delay(300);
    setColor("Off");
    delay(100);
  }

  Serial.println("\n[Network] SUCCESS! Connected to WiFi.");
  Serial.print("[Network] Wemos IP Address: ");
  Serial.println(WiFi.localIP());

  flashColor("Green", 2, 500); // wifi success
  setColor(currentColor);
}

String sendApiRequest(String endpoint, String payload, bool silent = false, bool isGET = false) {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  http.setTimeout(15000);

  String fullUrl = String(serverURL) + endpoint;

  Serial.print("[Network] Target URL: ");
  Serial.println(fullUrl);
  Serial.print("[Network] Payload:    ");
  Serial.println(payload);

  http.begin(client, fullUrl);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = 0;

  if (isGET) {
    httpResponseCode = http.GET();
  } else {
    httpResponseCode = http.POST(payload);
  }

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
      if (!silent) {
        flashColor("Red", 4, 500); // API error color
        setColor(currentColor);
      }
    }
    else{
      Serial.println("[Network] ERROR: Failed to parse error response JSON");
      if (!silent) {
        flashColor("Red", 4, 500); // JSON response error color
        setColor(currentColor);
      }
    }
  } 
  else {
    Serial.println("[Network] ERROR: Connection Refused or Failed to reach server");
    if (!silent) {
      flashColor("White", 4, 500); // network error color
      setColor(currentColor);
    }
  }

  http.end();
  return "";
}

void sendGetSettings() {
  Serial.println("\n----------------------- GET SETTINGS HTTP REQUEST -----------------------");
  String response = sendApiRequest("/api/settings", "", true, true);
  Serial.println("-----------------------------------------------------------------------\n");

  lastGetSettingsTime = millis();
  if (response != "") {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, response);

    if (!error) {
      registerModeTimeout = doc["registrationTimer"].as<int>() * 1000;
      unregisterModeTimeout = doc["unregistrationTimer"].as<int>() * 1000;
      duplicateTimeout = doc["ignoreDuplicateScanTimer"].as<int>() * 1000;
      getstatusInterval = doc["getStatusTimer"].as<int>() * 1000;
      weightCheckInterval = doc["weightUpdateTimer"].as<int>() * 1000;
      Serial.println("[Network] Settings successfully updated from server.");
    } else {
      Serial.println("[Network] ERROR1: Failed to parse error response JSON");
    }
  }
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
  String response = sendApiRequest("/api/locker/get-status", payload, true);
  Serial.println("-----------------------------------------------------------------------\n");

  if (response != "") {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      String lockerStatus = doc["status"].as<String>();
      return lockerStatus;
    } else {
      Serial.println("[Network] ERROR: Failed to parse error response JSON");
    }
  }
  return currentState; // return current state if failed to get status from server
}

void sendStartRegister() {
  Serial.println("\n---------------------- START REGISTER HTTP REQUEST -----------------------");
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/start-reg", payload, true);
  Serial.println("--------------------------------------------------------------------------\n");

  if (response != "") {
    Serial.println("[Locker] Switched to REGISTER mode");
    lastStartRegisterTime = millis();
    // setColor("Yellow"); // register color
  }
}

void sendFinishRegister() {
  Serial.println("\n---------------------- FINISH REGISTER HTTP REQUEST -----------------------");
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/finish-reg", payload);
  Serial.println("---------------------------------------------------------------------------\n");
  
  if (response != "") {
    Serial.println("[Locker] Registration successful. Switching to OCCUPIED mode.");
    flashColor("Blue", 4, 500); // register finish success
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
    flashColor("Green", 3, 500); // success color
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
      flashColor("Green", 4, 500); // Authorized
      setColor(currentColor);
      openLocker();
    } else {
      Serial.println("[Locker] Access Denied.");
      flashColor("Red", 4, 500); // Denied
      setColor(currentColor);
    }
  }
}

void sendClosedLocker() {
  Serial.println("\n---------------------- CLOSE LOCKER HTTP REQUEST -----------------------");
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/close-locker", payload, true);
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
    flashColor("Green", 4, 500); // success color
    setColor("Green"); // idle color
  }
}

void sendUpdateWeight() {
  updateWeight();
  
  Serial.println("\n---------------------- UPDATE WEIGHT HTTP REQUEST -----------------------");
  String payload = createJSONPayload();
  String response = sendApiRequest("/api/locker/update-weight", payload, true);
  Serial.println("-------------------------------------------------------------------------\n");
  
  if (response != "") {
    Serial.println("[Locker] Weight updated successfully.");
  }
}