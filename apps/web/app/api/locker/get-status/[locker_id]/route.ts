import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@repo/db";

function get_locker_state(lastLog, locker){
  // 4. Logic State
  let state = "IDLE";
  if (lastLog?.sysType === 'Tampered') {
    state = "TAMPERED";
  } else if (locker) {
    state = "OCCUPIED";
  }
  return state;
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ locker_id: string }> }
) {
  try {

    const {locker_id} = await params
    
    // Strict check for the ID
    if (!locker_id ) {
      return NextResponse.json({ error: "Route parameter 'id' not found" }, { status: 400 });
    }

    const l_id = parseInt(locker_id, 10)

    console.log("Status Request for ID:", l_id, locker_id);
    
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    // check if locker in database
    if (!locker){
      return NextResponse.json({ error: "Locker not found" }, { status: 404 });
    }
    

    // Check if it's actually a number (Note: 0 is a valid number!)
    if (isNaN(l_id)) {
      return NextResponse.json({ error: `Value '${l_id}' is not a valid number` }, { status: 400 });
    }

    // 3. Database Queries
    const [userLocker, lastLog] = await Promise.all([
      prisma.userLocker.findFirst({
        where: { lockerId: l_id }
      }),
      prisma.auditLog.findFirst({
        where: { lockerId: l_id },
        orderBy: { createdAt: 'desc' },
        select: { sysType: true } // Avoid BigInt logId crash
      })
    ]);

    // 4. Logic State
    let state = get_locker_state(lastLog, userLocker);

    return NextResponse.json({ 
      status: state,
      lockerId: l_id 
    });   

  } catch (err) {
    console.error("Status Route Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}