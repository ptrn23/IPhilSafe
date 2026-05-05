FROM python:3.11-slim

# Install WireGuard tools
RUN apt-get update && apt-get install -y wireguard iproute2 git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code and cert files
COPY main.py config.toml pdec_ida_partner.pem keystore.p12 keystore-signed.p12 ./
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
