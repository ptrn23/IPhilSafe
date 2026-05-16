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
    writeRGB(0, 175, 175);
  } else if (color == "White") {
    writeRGB(175, 175, 175);
  } else if (color == "Off") {
    writeRGB(0, 0, 0);
  } else {
    writeRGB(255, 50, 100); // default to pink for unknown colors
  }
}

void flashColor(String color, int times, int delayTime) {
  for (int i = 0; i < times; i++) {
    setColor(color);
    delay(delayTime);
    setColor("Off");
    delay(50);
  }
}

String statusToLED(String status) {
  if (status == "IDLE") {
    return "Green";
  } else if (status == "OCCUPIED") {
    return "Blue";
  } else if (status == "REGISTER") {
    return "Yellow";
  } else if (status == "TAMPERED") {
    return "Red";
  } else if (status == "UNREGISTER") {
    return "Orange";
  } else {
    return "White"; // default unknown status color
  }
}