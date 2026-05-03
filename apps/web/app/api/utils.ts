import { prisma, Locker, sys_log_type } from "@repo/db";

export async function get_locker_state(l: Locker | null){
  if (!l){
    return null;
  }
  
  const last_log = await prisma.auditLog.findFirst({
  where: { lockerId: l.lockerId },
  orderBy: { createdAt: 'desc' },
  select: { sysType: true } // Avoid BigInt logId crash
  })
  // 4. Logic State
  let state = "IDLE";
  if (last_log?.sysType === 'Tampered') {
    state = "TAMPERED";
  } else if (last_log?.sysType === 'Registering' || last_log?.sysType === 'Added_user') {
    state = "REGISTER";
  } else if (l) {
    state = "OCCUPIED";
  }
  return state;
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
  led: "Green" | "Red";
  message?: string;
  // Add any other fields returned, like:
  // uin?: string;
}

/**
 * Sends scanned QR data to the Python MOSIP backend for cryptographic verification.
 * * @param qrData The raw string data scanned from the QR code.
 * @returns A promise resolving to the VerifyResult.
 */
export async function verifyWithMOSIP(qrData: string): Promise<VerifyResult> {
  if (!qrData) {
    return { status: "error", led: "Red", message: "No QR data provided" };
  }

  // Use the environment variable in production, fallback to localhost for development
  const PYTHON_BACKEND_URL = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";

  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Ensure the key 'qr_data' perfectly matches your Python Pydantic model
      body: JSON.stringify({ qr_data: qrData }),
    });

    if (!response.ok) {
      console.error(`Python backend rejected the request with status: ${response.status}`);
      return { 
        status: "error", 
        led: "Red", 
        message: `Backend HTTP error: ${response.status}` 
      };
    }

    const data = await response.json();
    return data as VerifyResult;

  } catch (error) {
    console.error("Failed to connect to the Python backend:", error);
    return { 
      status: "error", 
      led: "Red", 
      message: "Could not reach the MOSIP microservice" 
    };
  }
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
    // 2. Send it to your Python backend utility
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
       console.log("❌ ERROR: The backend threw an exception (check Python terminal).");
    }

    return result;

  } catch (error) {
    console.error("🔥 FATAL TEST ERROR:", error);
    return null;
  }
}