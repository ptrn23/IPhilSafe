import { prisma, Locker, sys_log_type } from "@repo/db";
import https from "https";
import fetch from "node-fetch";

export async function get_locker_state(l: Locker | null){
  if (!l){
    return null;
  }
  
  const [last_log, isOccupied] = await Promise.all([
    prisma.auditLog.findFirst({
      where: { 
        lockerId: l.lockerId,
        sysType: {
          in: ["Registration_Started", "Registration_Finished", "Tampered", "Revoke_Access"]
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { sysType: true } // Avoid BigInt logId crash
    }),
    prisma.userLocker.findFirst({
      where: {
        lockerId: l.lockerId
      }
    })
  ])
  
  // 4. Logic State
  let state = "IDLE";
  if (!isOccupied && last_log?.sysType != 'Registration_Started'){
    state = "IDLE";
  } else  if (last_log?.sysType === 'Tampered') {
    state = "TAMPERED";
  } else if (last_log?.sysType === 'Registration_Started') {
    state = "REGISTER";
  } else if (isOccupied) {
    state = "OCCUPIED";
  }
  return state;
}
export async function isLockerClosed(l: Locker | null){
  if (!l){
    return false;
  }
  
  const last_log = await prisma.auditLog.findFirst({
    where: { 
      lockerId: l.lockerId,
      sysType: {
        in: ["Locker_Closed", "Locker_Opened"]
      }
    },
    orderBy: { createdAt: 'desc' },
    select: { sysType: true } // Avoid BigInt logId crash
  })
  if (last_log && last_log.sysType == "Locker_Closed"){
    return true
  }
  return false;
}

export async function create_audit_log(l_id: number, sys_type: sys_log_type, msg: string, user_id : string|null = null){
  await prisma.auditLog.create({
    data: { 
      lockerId: l_id, 
      sysType: sys_type, 
      logMsg: msg,
      user_id: user_id ?? null
    }
  });
}

// MOSIP QR Verification
// Define the expected response structure from Python backend
export interface VerifyResult {
  status: "verified" | "rejected" | "error";
  led: "Blue" | "Red";
  uin: string | null;
  name: string | null;
  message: string | null;
}

// ----------------------------------------------------------------
// MOSIP_BACKEND = "mock"   → cs145 mock server (yes-no auth)
// MOSIP_BACKEND = "remote" → mosip-service.fly.dev (default)
// MOSIP_BYPASS  = "true"   → skip all verification entirely (dev)
// ----------------------------------------------------------------

/**
 * Calls the CS145 mock server at /api/v1/auth/yes-no.
 * QR data is expected to be a JSON string with { UIN/uin, dob, name }.
 */
async function verifyWithMockServer(qrData: string): Promise<VerifyResult> {
  console.log("🔍 MOSIP MOCK | Sending yes-no auth for UIN:", qrData);
  const MOCK_URL = "https://cs145-iot-cup-1745973870.ap-southeast-1.elb.amazonaws.com";

  let parsed: { uin?: string; UIN?: string; dob?: string; name?: string };
  try {
    parsed = JSON.parse(qrData);
  } catch {
    return { status: "error", led: "Red", uin: null, name: null, message: "Invalid JSON in QR data" };
  }

  const individual_id = parsed.UIN ?? parsed.uin ?? null;
  const dob = parsed.dob ?? null;
  const name = parsed.name ?? null;

  if (!individual_id) {
    return { status: "error", led: "Red", uin: null, name: null, message: "No UIN found in QR data" };
  }

  console.log("🔍 MOSIP MOCK | Sending yes-no auth for UIN:", individual_id);

  try {

    const response = await fetch(`${MOCK_URL}/api/v1/auth/yes-no`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      agent: new https.Agent({ rejectUnauthorized: false, checkServerIdentity: () => undefined }),
      body: JSON.stringify({
        individual_id,
        consent: true,
        ...(dob  && { dob }),
        ...(name && { name }),
      }),
    } as any);

    if (!response.ok) {
      console.error(`MOSIP mock server error: ${response.status}`);
      return { status: "error", led: "Red", uin: null, name: null, message: `Mock server HTTP error: ${response.status}` };
    }

    const data = (await response.json()) as any;
    console.log("🔍 MOSIP MOCK | response:", data);

    // The mock server returns errors as a non-null errors array
    if (data.errors && data.errors.length > 0) {
      const errMsg = data.errors.map((e: { errorMessage: string }) => e.errorMessage).join("; ");
      console.warn("MOSIP mock rejected:", errMsg);
      return { status: "rejected", led: "Red", uin: individual_id, name, message: errMsg };
    }

    if (data.response?.authStatus === true) {
      return { status: "verified", led: "Blue", uin: individual_id, name, message: null };
    }

    return { status: "rejected", led: "Red", uin: individual_id, name, message: "Authentication failed" };

  } catch (error) {
    console.error("Failed to connect to MOSIP mock server:", error);
    return { status: "error", led: "Red", uin: null, name: null, message: "Could not reach the MOSIP mock server" };
  }
}

/**
 * Calls the remote Python microservice at /api/verify.
 * Passes raw QR data as-is.
 */
async function verifyWithRemoteServer(qrData: string): Promise<VerifyResult> {
  const PYTHON_BACKEND_URL = process.env.PYTHON_API_URL || "https://mosip-service.fly.dev";
  console.log("🔍 MOSIP REMOTE | qrData received:", qrData);

  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data: qrData }),
    });

    if (!response.ok) {
      console.error(`MOSIP backend rejected the request with status: ${response.status}`);
      return { status: "error", led: "Red", uin: null, name: null, message: `Backend HTTP error: ${response.status}` };
    }

    const data = await response.json();
    console.log("🔍 MOSIP REMOTE | response:", data);
    return data as VerifyResult;

  } catch (error) {
    console.error("Failed to connect to the MOSIP backend:", error);
    return { status: "error", led: "Red", uin: null, name: null, message: "Could not reach the MOSIP microservice" };
  }
}

export async function verifyWithMOSIP(qrData: string): Promise<VerifyResult> {
  if (!qrData) {
    return { status: "error", led: "Red", uin: null, name: null, message: "No QR data provided" };
  }

  // ----------------------------------------------------------------
  // DEV BYPASS — set MOSIP_BYPASS=true in .env.local to skip MOSIP
  // ----------------------------------------------------------------
  if (process.env.MOSIP_BYPASS === "true") {
    console.log("⚠️  MOSIP_BYPASS enabled — skipping real verification");
    let parsed: { uin?: string; UIN?: string; name?: string };
    try {
      parsed = JSON.parse(qrData);
    } catch {
      return { status: "error", led: "Red", uin: null, name: null, message: "Invalid JSON in bypass mode" };
    }
    return {
      status: "verified",
      led: "Blue",
      uin: parsed.UIN ?? parsed.uin ?? null,
      name: parsed.name ?? null,
      message: null,
    };
  }

  // ----------------------------------------------------------------
  // MOSIP_BACKEND = "mock"   → CS145 mock server
  // MOSIP_BACKEND = "remote" → mosip-service.fly.dev (default)
  // ----------------------------------------------------------------
  const backend = process.env.MOSIP_BACKEND ?? "remote";

  if (backend === "mock") {
    console.log("🔀 MOSIP routing to: MOCK SERVER");
    return verifyWithMockServer(qrData);
  }

  console.log("🔀 MOSIP routing to: REMOTE SERVER");
  return verifyWithRemoteServer(qrData);
}

export async function runMosipTest() {
  console.log("Starting MOSIP backend test...");

  // 1. Construct the exact JSON string format that parse_qr demands
  const mockQrPayload = JSON.stringify({
      UIN: "4104961936",
      dob: "2004/02/17", //  check format
      name: "Cellin Louise Cheng"
    }
  );

  try {
    // 2. Send it to your backend (respects MOSIP_BACKEND env var)
    const result = await verifyWithMOSIP(mockQrPayload);

    // 3. Log the results
    console.log("--- MOSIP TEST RESULTS ---");
    console.log(`Status: ${result.status}`);
    console.log(`LED Color: ${result.led}`);
    
    if (result.message) {
      console.log(`Message/Error: ${result.message}`);
    }

    if (result.status === "verified") {
       console.log("✅ SUCCESS: MOSIP cryptographically verified the user!");
    } else if (result.status === "rejected") {
       console.log("⚠️ REJECTED: Connection worked, but MOSIP says the UIN/DOB is invalid.");
    } else {
       console.log("❌ ERROR: The backend threw an exception (check server terminal).");
    }

    return result;

  } catch (error) {
    console.error("🔥 FATAL TEST ERROR:", error);
    return null;
  }
}