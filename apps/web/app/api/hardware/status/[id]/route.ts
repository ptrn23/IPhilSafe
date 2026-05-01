import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@repo/db";

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> | { id: string } } // Handles both Next.js 14 and 15
) {
  try {
    // 1. Resolve params (Supports newer Next.js versions)
    const resolvedParams = await params;
    const rawId = resolvedParams.id;

    console.log("Status Request for ID:", rawId);

    // 2. Strict check for the ID
    if (rawId === undefined || rawId === null) {
      return NextResponse.json({ error: "Route parameter 'id' not found" }, { status: 400 });
    }

    const lid = parseInt(rawId, 10);

    // Check if it's actually a number (Note: 0 is a valid number!)
    if (isNaN(lid)) {
      return NextResponse.json({ error: `Value '${rawId}' is not a valid number` }, { status: 400 });
    }

    // 3. Database Queries
    const [userLocker, lastLog] = await Promise.all([
      prisma.userLocker.findFirst({
        where: { lockerId: lid }
      }),
      prisma.auditLog.findFirst({
        where: { lockerId: lid },
        orderBy: { createdAt: 'desc' },
        select: { sysType: true } // Avoid BigInt logId crash
      })
    ]);

    // 4. Logic State
    let state = "IDLE";
    if (lastLog?.sysType === 'Tampered') {
      state = "TAMPERED";
    } else if (userLocker) {
      state = "OCCUPIED";
    }

    return NextResponse.json({ 
      status: state,
      lockerId: lid 
    });

  } catch (err) {
    console.error("Status Route Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}