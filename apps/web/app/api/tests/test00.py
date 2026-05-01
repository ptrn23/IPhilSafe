import requests
import json
import time

# --- CONFIGURATION ---
# Replace with your actual Vercel URL
BASE_URL = "http://localhost:3000/api/hardware"
LOCKER_ID = 1

def test_qr_scan(qr_data):
    print(f"\n[SCAN] Simulating QR Scan: {qr_data}")
    payload = {
        "qrData": qr_data,
        "lockerId": LOCKER_ID
    }
    response = requests.post(f"{BASE_URL}/scan", json=payload)
    print(f"Response ({response.status_code}): {response.text}")

def test_weight_update(weight):
    print(f"\n[WEIGHT] Sending current weight: {weight}g")
    payload = {
        "lockerId": LOCKER_ID,
        "weight": weight
    }
    response = requests.post(f"{BASE_URL}/weight", json=payload)
    print(f"Response ({response.status_code}): {response.text}")

def test_status_polling():
    print(f"\n[STATUS] Checking locker {LOCKER_ID} status...")
    response = requests.get(f"{BASE_URL}/status/{LOCKER_ID}")
    print(f"Response ({response.status_code}): {response.text}")


def test_register_locker():
    print(f"\n[REGISTER] Initializing Locker {LOCKER_ID}...")
    payload = {"lockerId": LOCKER_ID}
    # Note the path: /api/lockers/register
    response = requests.post(f"http://localhost:3000/api/lockers/register", json=payload)
    print(f"Response ({response.status_code}): {response.text}")

# --- EXECUTION SIMULATION ---
if __name__ == "__main__":
    # Step 0: Register the locker (only needed once, but we can run it every time for testing)
    test_register_locker()

    # Step 1: Simulate a user scanning a PhilSys QR
    test_qr_scan("234242423")
    
    time.sleep(2) # Wait for 2 seconds
    
    # Step 2: Simulate weight being placed (e.g., 500 grams)
    test_weight_update(500.0)
    
    time.sleep(2)

    # Step 3: Poll the status to see if the LED should be BLUE (Occupied)
    test_status_polling()

    # Step 4: Simulate a weight change (Tamper Test - e.g., weight dropped to 10g)
    print("\n--- Testing Tamper Detection ---")
    test_weight_update(10.0)