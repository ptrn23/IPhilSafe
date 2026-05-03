import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@repo/db";
import { get_locker_state } from '@/app/api/utils';
export async function POST(
    req: NextRequest,
) {
  try {

    const {locker_id} = await req.json()
    
    // Strict check for the ID
    if (locker_id == undefined || locker_id == null ) {
      return NextResponse.json({ error: "Route parameter 'id' not found" }, { status: 400 });
    }

    const l_id = parseInt(locker_id, 10)
    // Check if it's actually a number (Note: 0 is a valid number!)
    if (isNaN(l_id)) {
      return NextResponse.json({ error: `Value '${l_id}' is not a valid number` }, { status: 400 });
    }

    console.log("Status Request for ID:", l_id, locker_id);
    
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    // check if locker in database
    if (!locker){
      return NextResponse.json({ error: "Locker not found" }, { status: 404 });
    }

    // 4. Logic State
    const state = await get_locker_state(locker);
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