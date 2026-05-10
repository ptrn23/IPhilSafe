import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@repo/db";

export async function POST(
    req: NextRequest,
) {
  try {
    const {user_id}  = await req.json()
    // 2. Strict check for the ID
    if (!user_id) {
      return NextResponse.json(
        { error: "Route parameters not found"}, 
        { status: 400 }
      );
    }

    console.log("Audit logs accessed by user:", user_id);

    const user = await prisma.user.findFirst({
      where: { uinPhilsys: user_id }
    });

    // check if user exists
    if (!user){
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 404 }
        );
    }

    // 2. Strict check for the ID
    if (user.userRole != 'Admin') {
      return NextResponse.json(
        { error: "Only for admin access"}, 
        { status: 401 }
      );
    }
                      
    const res = await prisma.auditLog.findMany();
    const safeRes = JSON.parse(
    JSON.stringify(res, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(safeRes);     
  } catch (err) {
    console.error("Status Route Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}