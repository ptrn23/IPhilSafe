import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { create_audit_log, get_locker_state, verifyWithMOSIP } from '../../utils';
export async function POST(
    req: NextRequest,
) {
  try {
    const { qr_data, locker_id } = await req.json();
    // Strict check for the params
    if (!qr_data || locker_id == undefined || locker_id == null) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }
    const user_data = JSON.parse(qr_data);
    const uin = user_data.uin;
    const name = user_data.name;
    const l_id = Number(locker_id);
    // Check if locker id is a number (Note: 0 is a valid number!)
    if (isNaN(l_id)) {
      return NextResponse.json({ error: `Value ${l_id} is not a valid number` }, { status: 400 });
    }

    // MOSIP verification
    const mosipResult = await verifyWithMOSIP(JSON.stringify(user_data));
    if (mosipResult.status !== "verified") {
      return NextResponse.json({ error: `MOSIP verification failed: ${mosipResult.message || "Unknown error"}` }, { status: 401 });
    }

    // check if user and locker exists
    const user = await prisma.user.findUnique({
      where: { uinPhilsys: uin }
    });
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    if (!user) {
      return NextResponse.json({ error: `User not found` }, { status: 404 });
    }
    if (!locker){
      return NextResponse.json({ error: `Locker ${l_id} not found` }, { status: 404 });
    }

    // check if existing relationship between locker and user
    const isUserVerified = await prisma.userLocker.findFirst({
      where:{
        userId: uin, 
        lockerId: l_id
      }
    });

    // create log and return response based on verification result
    const l_state = await get_locker_state(locker);
    if (l_state != "OCCUPIED" && l_state != "TAMPERED"){
      return NextResponse.json({ error: "Locker is not occupied" }, { status: 404 });
    }
    if (l_state == "OCCUPIED"){
      if (isUserVerified){
      // console.log("authorized locker")
      create_audit_log(l_id, 'Locker_Opened', "Locker opened by user", uin )      
      return NextResponse.json({ message: "Authorized", name: user.name });
      }
      else {
      }
    }
    else if (l_state == "TAMPERED"){
      if (user.userRole == "Admin"){
        // console.log("authorized locker")
        create_audit_log(l_id, 'Locker_Opened', "Locker opened by admin during tampered state", uin )      
        return NextResponse.json({ message: "Authorized", name: user.name });
      }
      else{
        // console.log("denied locker")
        create_audit_log(l_id, 'Denied_Access', "Only admin access for locker during TAMPERED state", uin )      
        return NextResponse.json({ message: "Denied", name: user.name });
      }
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}