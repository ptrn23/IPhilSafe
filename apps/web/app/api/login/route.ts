import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@repo/db";
import { verifyWithMOSIP } from '../utils';

// ----------------------------------------------------------------
// Helper: create a persistent session cookie
// ----------------------------------------------------------------
function buildSessionCookie(payload: string): string {
  // Adjust Max-Age / SameSite / Secure to your deployment needs
  return [
    `session=${payload}`,
    "HttpOnly",
    "Path=/",
    "Max-Age=86400",          // 24 hours
    "SameSite=Strict",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function POST(req: NextRequest) {
  try {
    // ----------------------------------------------------------------
    // 1. Parse request body — expects { qr_payload: string }
    // ----------------------------------------------------------------
    const { qr_payload } = await req.json();

    if (!qr_payload || typeof qr_payload !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid qr_payload" },
        { status: 400 }
      );
    }

    // ----------------------------------------------------------------
    // 2. Parse QR payload and verify through MOSIP
    // ----------------------------------------------------------------
    let verified_user_id: string;
    {
    // Pass qr_payload raw — do NOT parse/re-stringify before sending.
    // MOSIP validates the exact string it originally signed.
    const mosipResult = await verifyWithMOSIP(qr_payload);
    console.log("🔐 LOGIN | MOSIP full result:", JSON.stringify(mosipResult, null, 2)); // <-- add this
    if (mosipResult.status !== "verified") {
        return NextResponse.json(
        { error: `MOSIP verification failed: ${mosipResult.message || "Unknown error"}` },
        { status: 401 }
        );
    }

    if (!mosipResult.uin) {
        return NextResponse.json(
        { error: "MOSIP returned no UIN for verified user" },
        { status: 500 }
        );
    }

    verified_user_id = mosipResult.uin;
    }

    // ----------------------------------------------------------------
    // 3. Look up the verified user in the database
    // ----------------------------------------------------------------
    const user = await prisma.user.findFirst({
      where: { uinPhilsys: verified_user_id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 404 }
      );
    }

    // ----------------------------------------------------------------
    // 4. Confirm role is one we recognise
    // ----------------------------------------------------------------
    const role = user.userRole;
    if (role !== "User" && role !== "Admin") {
      return NextResponse.json(
        { error: "Account has an unrecognised role" },
        { status: 403 }
      );
    }

    // ----------------------------------------------------------------
    // 5. Build session token
    //    Swap the btoa() encoding for a signed JWT / encrypted token
    //    in production (e.g. jose, iron-session, next-auth).
    // ----------------------------------------------------------------
    const sessionPayload = btoa(
      JSON.stringify({
        user_id: user.uinPhilsys,
        role,
        iat: Date.now(),
      })
    );

    console.log(`Login granted — user: ${user.uinPhilsys}, role: ${role}`);

    // ----------------------------------------------------------------
    // 6. Return success and set the persistent session cookie
    // ----------------------------------------------------------------
    return new NextResponse(
      JSON.stringify({ message: "Login successful", role }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": buildSessionCookie(sessionPayload),
        },
      }
    );
  } catch (err) {
    console.error("Login Route Error:", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}