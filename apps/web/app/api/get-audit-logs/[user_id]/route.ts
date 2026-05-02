import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@repo/db";
import { get_locker_state } from "../../utils";

export async function GET(
    req: Request,
    { params }: { params: { user_id: string } }
) {
  try {
    const {user_id}  = await params;
    // 2. Strict check for the ID
    if (!user_id) {
      return NextResponse.json({ error: "Route parameter id not found" }, { status: 400 });
    }
    const u_id = parseInt(user_id, 10)

    console.log("Audit logs accessed by user:", u_id);

    const user = await prisma.user.findFirst({
      where: { uinPhilsys: u_id }
    });

    

    // 2. Strict check for the ID
    if (user.userRole != 'Admin') {
      return NextResponse.json({ error: "User role is not admin" }, { status: 400 });
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