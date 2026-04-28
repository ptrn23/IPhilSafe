from tokenize import String

from flask import Flask, request, jsonify

app = Flask(__name__)

AUTHORIZED_IDS = [
    "hello world",
]


@app.route('/api/verify', methods=['POST'])
def verify_scan():
    data = request.get_json()
    
    if not data:
        print("[ERROR] Received a request with no JSON payload.")
        return jsonify({"status": "error", "message": "Invalid format"}), 400
        
    print(f"\n[{request.remote_addr}] ---> Received Data: {data}")
    
    scanned_id = data.get("qr_data", "") 
    
    if scanned_id in AUTHORIZED_IDS:
        print(f"[SUCCESS] Access GRANTED for ID: {scanned_id}")
        
        response_payload = {
            "status": "authorized",
            "led": "Green"
        }
        return jsonify(response_payload), 200 # 200 OK
        
    else:
        print(f"[REJECTED] Access DENIED for ID: {scanned_id}")
        
        response_payload = {
            "status": "denied",
            "led": "Red"
        }
        return jsonify(response_payload), 401 # 401 Unauthorized

if __name__ == '__main__':
    print("==================================================")
    print("  IPhilSafe Local Backend Server is RUNNING!")
    print("==================================================")
    print("Waiting for ESP8266 scans...")

    print(AUTHORIZED_IDS)
    
    app.run(host='172.20.10.2', port=8000)