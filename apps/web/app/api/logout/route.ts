import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // ----------------------------------------------------------------
    // 1. Overwrite the session cookie with an expired one to clear it
    // ----------------------------------------------------------------
    const expiredCookie = [
      "session=",
      "HttpOnly",
      "Path=/",
      "Max-Age=0",          // immediately expires
      "SameSite=Strict",
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    console.log("User logged out — session cleared");

    return new NextResponse(
      JSON.stringify({ message: "Logged out successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": expiredCookie,
        },
      }
    );
  } catch (err) {
    console.error("Logout Route Error:", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}