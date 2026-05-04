import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@repo/db";
import { get_locker_state , create_audit_log} from "../../utils";

export async function POST(
  req: NextRequest,
) {
  try {
    const {locker_id, user_id}  = await req.json()
    // Strict check for the params
    if (locker_id == undefined || locker_id == null || !user_id ) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }

    const l_id = parseInt(locker_id, 10)
      // Check if weight and locker id is a number (Note: 0 is a valid number!)
    if (isNaN(l_id)) {
      return NextResponse.json({ error: `Value ${l_id} is not a valid number` }, { status: 400 });
    }

    // verify locker exists
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    if (!locker){
      return NextResponse.json({ error: `Locker ${l_id} not found` }, { status: 404 });
    }

    // verify user exists
    const user = await prisma.user.findFirst({
      where: { uinPhilsys: user_id }
    });

    if (user === undefined || user === null) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // For admin users only
    if (user.userRole != "Admin"){
      return NextResponse.json({ error: "Only for admin access" }, { status: 401 });
    }

    console.log("Revoking access for locker ID:", l_id);

    const cur_l_state = await get_locker_state(locker)
    if ( cur_l_state!= "TAMPERED"){
      return NextResponse.json({ error: `Locker is not TAMPERED. In state ${cur_l_state}` }, { status: 409 });
    }
    // 1. Remove the user assignment (handleCheckout)
    // We use deleteMany because lockerId isn't the unique ID on its own in userLocker
    await prisma.userLocker.deleteMany({ 
      where: { 
        lockerId: l_id
      } 
    });

    // Log the event 
    create_audit_log(l_id, 'Revoke_Access', "Access to the locker is revoked by admin user", user_id)

    // 3. Reset the locker weight to 0 or a baseline if needed
    await prisma.locker.update({
      where: { lockerId: l_id },
      data: { weight: 0 }
    });

    return NextResponse.json({ status: "IDLE" });
  } catch (err) {
    console.error("Status Route Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}