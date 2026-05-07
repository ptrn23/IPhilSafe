import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // ----------------------------------------------------------------
    // 1. Read the session cookie set by /api/login
    // ----------------------------------------------------------------
    const sessionCookie = req.cookies.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------------
    // 2. Decode the session payload
    //    This mirrors the btoa(JSON.stringify(...)) encoding in login
    // ----------------------------------------------------------------
    let payload: { user_id: string; role: string; iat: number };

    try {
      payload = JSON.parse(atob(sessionCookie));
    } catch {
      return NextResponse.json(
        { error: "Malformed session token" },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------------
    // 3. Validate payload shape
    // ----------------------------------------------------------------
    if (!payload.user_id || !payload.role) {
      return NextResponse.json(
        { error: "Invalid session payload" },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------------
    // 4. Return the session info to the client
    // ----------------------------------------------------------------
    return NextResponse.json({
      user_id: payload.user_id,
      role: payload.role,
    });

  } catch (err) {
    console.error("Session Route Error:", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}