import json
import logging
import os
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from dynaconf import Dynaconf
from fastapi import FastAPI
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

# Load DATABASE_URL from the shared database .env file
DB_ENV_FILE = SERVICE_DIR / "../../packages/database/.env"
load_dotenv(dotenv_path=DB_ENV_FILE)

config = Dynaconf(settings_files=[str(SERVICE_DIR / "config.toml")], environments=False)
authenticator = MOSIPAuthenticator(config=config)

# database config
DATABASE_URL: str = os.environ.get("DATABASE_URL") or config.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to packages/database/.env or export it as an environment variable."
    )

app = FastAPI()

class ScanRequest(BaseModel):
    qr_data: str

class ScanResponse(BaseModel):
    status: str  # "verified" | "rejected" | "error"
    led: str
    uin: str | None = None
    name: str | None = None
    message: str | None = None

# inserts a verified user into the user table in db
def save_verified_user(uin: str, name: str) -> None:
    try:
        conn = psycopg2.connect(DATABASE_URL)
        try:
            with conn:                        # auto-commit on success, rollback on exception
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO "user" (uin_philsys, first_name, user_role)
                        VALUES (%s, %s, 'User')
                        ON CONFLICT (uin_philsys) DO NOTHING
                        """,
                        (int(uin), name[:100]),   # cast UIN to int; truncate name to VarChar(100)
                    )
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"user table write failed: {e}")

def parse_dob(raw_dob: str) -> str:
    """Convert 'July 14, 1986' → '1986/07/14' as expected by MOSIP."""
    try:
        return datetime.strptime(raw_dob.strip(), "%B %d, %Y").strftime("%Y/%m/%d")
    except ValueError as e:
        raise ValueError(f"Unrecognised DOB format {raw_dob!r} (expected e.g. 'July 14, 1986')") from e

def parse_qr(raw: str) -> dict:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"QR payload is not valid JSON: {e}") from e

    subject = data.get("subject", {})

    uin = subject.get("UIN") or subject.get("uin")
    raw_dob = subject.get("DOB") or subject.get("dob")
    fname = subject.get("fName") or subject.get("firstName") or ""
    lname = subject.get("lName") or subject.get("lastName") or ""
    name = f"{fname} {lname}".strip() or None

    if not uin:
        raise ValueError(f"QR subject missing UIN. subject keys: {list(subject.keys())}")
    if not raw_dob:
        raise ValueError(f"QR subject missing DOB. subject keys: {list(subject.keys())}")

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
        return ScanResponse(status="error", led="Red", message=str(e))

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
        return ScanResponse(status="error", led="Red", uin=uin, name=name, message=str(e))

    status = "verified" if verified else "rejected"
    led = "Green"    if verified else "Red"

    if verified:
        save_verified_user(uin, name or "")

    return ScanResponse(status=status, led=led, uin=uin, name=name)
