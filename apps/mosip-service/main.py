import json
import logging
import os
from datetime import datetime
from pathlib import Path

from dynaconf import Dynaconf
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mosip_auth_sdk import MOSIPAuthenticator
from mosip_auth_sdk.models import DemographicsModel
from pydantic import BaseModel

'''
INSTRUCTIONS TO RUN LOCALLY:
1. turn on WireGuard tunnel
2. activate .venv (source .venv/bin/activate)
3. uvicorn main:app --host 0.0.0.0 --port 8000
'''

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SERVICE_DIR = Path(__file__).parent
os.chdir(SERVICE_DIR)

config = Dynaconf(settings_files=[str(SERVICE_DIR / "config.toml")], environments=False)
authenticator = MOSIPAuthenticator(config=config)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScanRequest(BaseModel):
    qr_data: str

class ScanResponse(BaseModel):
    status: str  # "verified" | "rejected" | "error"
    uin: str | None = None
    name: str | None = None
    message: str | None = None


def parse_dob(raw_dob: str) -> str:
    """Convert 'July 14, 1986' → '1986/07/14', or return as-is if already in 'YYYY/MM/DD'."""
    clean_dob = raw_dob.strip()

    # 1. First check: MOSIP format (YYYY/MM/DD)
    try:
        datetime.strptime(clean_dob, "%Y/%m/%d")
        return clean_dob  # It's valid, return it exactly as is
    except ValueError:
        pass # Not in YYYY/MM/DD format, move to the next check

    # 2. Second check: Spelled-out format
    try:
        return datetime.strptime(clean_dob, "%B %d, %Y").strftime("%Y/%m/%d")
    except ValueError as e:
        raise ValueError(
            f"Unrecognised DOB format {raw_dob!r}. "
            "Expected either 'YYYY/MM/DD' or 'July 14, 1986'."
        ) from e

def parse_qr(raw: str) -> dict:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"QR payload is not valid JSON: {e}") from e

    subject = data.get("subject", data)

    uin = subject.get("UIN") or subject.get("uin")
    raw_dob = subject.get("DOB") or subject.get("dob")
    name = subject.get("name") or subject.get("Name")  

    if not uin:
        raise ValueError(f"QR data missing UIN. subject keys: {list(subject.keys())}")
    if not raw_dob:
        raise ValueError(f"QR data missing DOB. subject keys: {list(subject.keys())}")

    return {"uin": str(uin), "dob": parse_dob(raw_dob), "name": name}

# API endpoints
@app.post("/api/verify", response_model=ScanResponse)
async def verify(body: ScanRequest):
    logger.info(f"Raw QR data: {body.qr_data!r}")

    # parse qr
    try:
        qr = parse_qr(body.qr_data)
    except ValueError as e:
        logger.error(f"QR parse error: {e}")
        return ScanResponse(status="error", message=str(e))

    uin, dob, name = qr["uin"], qr["dob"], qr["name"]
    logger.info(f"Parsed — UIN: {uin}  DOB: {dob}  Name: {name}")

    # mosip auth
    try:
        demographics = DemographicsModel(dob=dob)
        response = authenticator.auth(
            individual_id=uin,
            individual_id_type="UIN",
            demographic_data=demographics,
            consent=True,
        )
        response_body = response.json()
        logger.info(f"MOSIP response: {response_body}")
        verified: bool = response_body.get("response", {}).get("authStatus", False)
    except Exception as e:
        logger.error(f"MOSIP auth error: {e}")
        return ScanResponse(status="error", uin=uin, name=name, message=str(e))

    status = "verified" if verified else "rejected"

    logger.info(f"Verification result for UIN {uin}: {status.upper()}")

    return ScanResponse(status=status, uin=uin, name=name)
