from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import base64
from datetime import datetime

app = Flask(__name__)
# Enable CORS so your React app (port 8082) can talk to this Flask server (port 8000)
CORS(app, resources={r"/*": {"origins": "*"}}) 

# ================= CONFIGURATION =================
CONSUMER_KEY    = "LlaGAisUgyllJN3u3jfJnWIWGzavg7pJ8zuirp6yHwuSXCgW"
CONSUMER_SECRET = "GglWXlu0136vbVj2wes44hbqb3NpkGKD6lVCw1EiaeEqmdSNuh1xicupmATtnlLG"
PASSKEY         = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
SHORTCODE       = "174379"
CALLBACK_URL    = "https://slider-passerby-even.ngrok-free.dev/callback"

# ================= HARDWARE & PRICING =================
ESP32_IP        = "192.168.1.102" 
ADMIN_PASSWORD  = "maji1234"
price_per_litre = 150.0  
max_litres      = 5.0

payment_results = {}

# ================= ACCESS TOKEN =================
def get_access_token():
    url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    try:
        res = requests.get(url, auth=(CONSUMER_KEY, CONSUMER_SECRET))
        return res.json().get('access_token')
    except Exception as e:
        print(f"❌ Token Error: {e}")
        return None

# ================= ROUTES =================

@app.route('/price', methods=['GET'])
def get_price():
    """This route provides the initial price to React to prevent NaN errors."""
    return jsonify({
        "price_per_litre": price_per_litre,
        "max_litres": max_litres
    })

@app.route('/pay', methods=['POST'])
def trigger_stk():
    data   = request.json
    phone  = data.get('phone')
    litres = float(data.get('litres', 1))
    amount = int(round(litres * price_per_litre))

    token = get_access_token()
    if not token: return jsonify({"error": "Failed to get access token"}), 500

    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    password  = base64.b64encode((SHORTCODE + PASSKEY + timestamp).encode()).decode()

    payload = {
        "BusinessShortCode": SHORTCODE, "Password": password, "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline", "Amount": amount, "PartyA": phone,
        "PartyB": SHORTCODE, "PhoneNumber": phone, "CallBackURL": CALLBACK_URL,
        "AccountReference": "MajiRun", "TransactionDesc": "Water Payment"
    }

    response = requests.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
                             json=payload, headers={"Authorization": f"Bearer {token}"})
    return jsonify(response.json())

@app.route('/callback', methods=['POST'])
def mpesa_callback():
    data = request.json
    callback = data['Body']['stkCallback']
    checkout_id = callback['CheckoutRequestID']
    result_code = callback['ResultCode']

    payment_results[checkout_id] = {"paid": result_code == 0, "cancelled": result_code != 0}

    if result_code == 0:
        print("✅ Payment Success! Signalling ESP32...")
        try:
            requests.get(f"http://{ESP32_IP}/dispense", timeout=5)
        except: print("❌ ESP32 Unreachable")
    return jsonify({"ResultCode": 0, "ResultDesc": "Success"})

@app.route('/admin/update-price', methods=['POST'])
def update_price():
    global price_per_litre, max_litres
    data = request.json
    if data.get('password') != ADMIN_PASSWORD:
        return jsonify({"error": "Unauthorized"}), 401
    
    price_per_litre = float(data.get('price_per_litre', price_per_litre))
    max_litres = float(data.get('max_litres', max_litres))
    
    return jsonify({
        "success": True, 
        "price_per_litre": price_per_litre, 
        "max_litres": max_litres
    })

@app.route('/payment-status', methods=['POST'])
def payment_status():
    checkout_id = request.json.get('checkout_id')
    return jsonify(payment_results.get(checkout_id, {"paid": None}))

@app.route('/')
def home(): return "💧 Maji Run Backend Active"

if __name__ == "__main__":
    app.run(port=8000, debug=True)