import json
import logging
import os
from datetime import datetime
from pathlib import Path

from dynaconf import Dynaconf
from fastapi import FastAPI
from mosip_auth_sdk import MOSIPAuthenticator
from mosip_auth_sdk.models import DemographicsModel
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SERVICE_DIR = Path(__file__).parent
os.chdir(SERVICE_DIR)

config = Dynaconf(settings_files=[str(SERVICE_DIR / "config.toml")], environments=False)
authenticator = MOSIPAuthenticator(config=config)

app = FastAPI()


class ScanRequest(BaseModel):
    qr_data: str


class ScanResponse(BaseModel):
    status: str  # "verified" | "rejected" | "error"
    uin: str | None = None
    name: str | None = None
    message: str | None = None


def parse_dob(raw_dob: str) -> str:
    """Convert 'July 14, 1986' → '1986/07/14' as expected by MOSIP."""
    try:
        return datetime.strptime(raw_dob.strip(), "%B %d, %Y").strftime("%Y/%m/%d")
    except ValueError as e:
        raise ValueError(f"Unrecognised DOB format {raw_dob!r} (expected e.g. 'July 14, 1986')") from e


def parse_qr(raw: str) -> dict:
    """Parse the PhilSys QR JSON payload into normalised uin/dob/name fields.

    Expected shape (single-line string from scanner):
      {"DateIssued": "...", "Issuer": "PSA",
       "subject": {"lName": "...", "fName": "...", "sex": "...",
                   "DOB": "July 14, 1986", "POB": "...", "UIN": "..."}}
    """
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


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/verify", response_model=ScanResponse)
async def verify(body: ScanRequest):
    logger.info(f"Raw QR data: {body.qr_data!r}")

    try:
        qr = parse_qr(body.qr_data)
    except ValueError as e:
        logger.error(f"QR parse error: {e}")
        return ScanResponse(status="error", message=str(e))

    uin, dob, name = qr["uin"], qr["dob"], qr["name"]
    logger.info(f"Parsed — UIN: {uin}  DOB: {dob}  Name: {name}")

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
    return ScanResponse(status=status, uin=uin, name=name)
