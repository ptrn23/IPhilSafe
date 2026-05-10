# GM861S QR Code Reader with WeMos D1 (ESP8266)

## Hardware

- **Scanner:** GROW GM861S UART/USB 1D/2D Barcode Reader Module
- **MCU:** WeMos D1 Mini (ESP8266)

## GM861S Specs

| Parameter | Value |
|-----------|-------|
| Operating Voltage | DC 3.3V |
| Operating Current | 70mA max |
| Standby Current | 6mA typical |
| Interface | TTL-232 / USB |
| Default Baud Rate | 9600 (8N1) |
| Sensor | 640x480 CMOS |
| Reading Distance | 5-30cm |
| Startup Time | 250ms typical |

### Pinout (6-pin, 1.0mm pitch connector)

| Pin | Name | Function |
|-----|------|----------|
| 1 | D+ | USB data output |
| 2 | D- | USB data input |
| 3 | GND | Signal ground |
| 4 | RXD | Serial receive (TTL 3.3V) |
| 5 | TXD | Serial transmit (TTL 3.3V) |
| 6 | VCC | Power input 3.3V |

### Supported Code Types

- **2D (default enabled):** QR Code, Data Matrix, PDF417
- **1D (default enabled):** EAN-13, EAN-8, UPC-A, UPC-E
- **1D (supported, disabled by default):** Code 128, Code 39, Code 93, CodaBar, Interleaved 2 of 5, ITF-14, ITF-6, ISBN, ISSN, MSI-Plessey, GS1 Databar, Code 11, and others

## Wiring

No level shifter needed — both devices operate at 3.3V logic.

```
GM861S              WeMos D1 Mini
------              -------------
Pin 6 (VCC) ------> 3.3V
Pin 3 (GND) ------> GND
Pin 5 (TXD) ------> D5 (GPIO14)
Pin 4 (RXD) ------> D6 (GPIO12)

Button (Options A & B only)
------              -------------
One leg  ----------> D7 (GPIO13)
Other leg ---------> GND
```

**Do not connect Pin 1 (D+) or Pin 2 (D-) — those are for USB only.**

## GM861S Initialization

The GM861S is configured by scanning setup QR codes printed in the
[user manual (PDF)](https://robu.in/wp-content/uploads/2024/08/GM861S.pdf).
A local copy is saved at `GM861S/GM861S_manual.pdf`.

### Required Setup Steps

1. **Set output to Serial:** Scan the **"Serial Output"** QR code (manual section 2.1, page 9). This ensures data is sent over the TTL-232 pins rather than USB.

2. **Set read mode:** Scan one of the following mode QR codes (manual section 3):
   - **Continuous Mode — Recommended** (section 3.1) — scans automatically; the firmware uses a button on D7 to gate when data is accepted, so continuous mode ensures the scanner is always ready when the button is pressed
   - **Induction Mode** (section 3.2) — scans when a new barcode appears in view
   - **Command Triggered Mode** (section 3.4) — scans only when a serial command is sent (trigger: `7E 00 08 01 00 02 01 AB CD`)
   - **Manual Mode** (section 3.3, default) — scans only when the scanner's own button is pressed

3. **Save settings:** Scan the **"Save"** QR code (manual section 1.7, page 7) to persist settings to flash.

### Optional Configuration

- **Baud rate:** Default is 9600. Can be changed by scanning baud rate QR codes (section 2.1, page 9). Options: 1200, 4800, 9600, 14400, 19200, 38400, 57600, 115200.
- **Factory reset:** Scan the **"Reset"** QR code (section 1.8, page 7) to restore all defaults.
- **Enable/disable code types:** Scan the relevant QR codes in section 8 of the manual.

## Serial Protocol Notes

- Data is sent as plain ASCII text terminated by `0x0D` (carriage return)
- Default serial settings: 9600 baud, 8 data bits, no parity, 1 stop bit (8N1)
- In Command Triggered Mode, the trigger command returns a 7-byte ack (`02 00 00 01 00 33 31`) before the actual scan data
- Heartbeat command: send `7E 00 0A 01 00 00 00 30 1A`, expect `03 00 00 01 00 33 31`

## Arduino IDE Setup

1. Install the **esp8266** board package (Arduino IDE > Board Manager)
2. Select board: **LOLIN(WEMOS) D1 ESP-WROOM-02 or LOLIN(WEMOS) D1 R1**
3. Open one of the sketches below
4. Upload and open Serial Monitor at **115200** baud

## Firmware Variants

### Button-Triggered (D7)

These sketches use a push button on D7 to gate or trigger scanning.

#### Option A: Continuous Mode + Button Gate (`GM861S_button_trigger.ino`)

Set the scanner to **Continuous Mode** (section 3.1). The scanner runs continuously, but the firmware only accepts data while the button is held. Data arriving when the button is released is discarded.

1. Press and hold the button
2. Present a QR/barcode to the scanner
3. The scanned data is printed to Serial
4. Release the button

#### Option B: Command Triggered Mode + Button Gate (`GM861S_command_trigger.ino`)

Set the scanner to **Command Triggered Mode** (section 3.4). The scanner stays idle until the MCU sends a trigger command (`7E 00 08 01 00 02 01 AB CD`) over serial. The button press sends this command, so the scanner only activates on demand — saving power compared to continuous scanning.

1. Press and hold the button (trigger command is sent once)
2. The scanner activates and reads a QR/barcode
3. The scanned data is printed to Serial
4. Release the button

### Serial-Triggered

These sketches replace the physical button with Serial Monitor input. No button or D7 wiring is needed. Send `1` to start reading and `0` to stop.

#### Option C: Continuous Mode + Serial Gate (`GM861S_serial_button_trigger.ino`)

Set the scanner to **Continuous Mode** (section 3.1). The scanner runs continuously, but the firmware only accepts data after you send `1` via Serial Monitor. Send `0` to stop.

1. Open Serial Monitor at 115200 baud
2. Send `1` to enable reading
3. Present a QR/barcode to the scanner
4. The scanned data is printed to Serial
5. Send `0` to disable reading

#### Option D: Command Triggered Mode + Serial Gate (`GM861S_serial_command_trigger.ino`)

Set the scanner to **Command Triggered Mode** (section 3.4). Sending `1` via Serial Monitor sends the trigger command to the scanner. Send `0` to stop.

1. Open Serial Monitor at 115200 baud
2. Send `1` to trigger a scan (trigger command is sent once)
3. The scanner activates and reads a QR/barcode
4. The scanned data is printed to Serial
5. Send `0` to stop

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No data received | Scan "Serial Output" QR code from manual. Verify TX/RX wiring. |
| Garbled text | Baud rate mismatch — confirm both sides are 9600 |
| Scanner LED doesn't light | Check VCC (3.3V) and GND connections |
| "31" instead of barcode data | That's the trigger ack — use Continuous Mode or discard first 7 bytes |
| Scanner won't scan | Check read mode — Manual Mode requires the scanner's own button press |
| Scan works but no output | Make sure the D7 button is held (Options A/B) or `1` was sent via Serial (Options C/D) |

> [!NOTE]
> It can take time to initialize the serial and continuous modes.
