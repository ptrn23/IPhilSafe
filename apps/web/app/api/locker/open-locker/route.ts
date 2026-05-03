import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { create_audit_log, get_locker_state, verifyWithMOSIP } from '../../utils';
export async function POST(
    req: NextRequest,
) {
  try {
    const { qrData, locker_id } = await req.json();
    // Strict check for the params
    if (!qrData || !locker_id) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }
    const user_data = JSON.parse(qrData);
    const uin = user_data.subject.uin;
    const name = user_data.subject.name;
    const l_id = Number(locker_id);

    // // MOSIP verification
    // const mosipResult = await verifyWithMOSIP(JSON.stringify(user_data.subject));
    // if (mosipResult.status !== "verified") {
    //   return NextResponse.json({ error: `MOSIP verification failed: ${mosipResult.message || "Unknown error"}` }, { status: 401 });
    // }

    // check if user and locker exists
    const user = await prisma.user.findUnique({
      where: { uinPhilsys: uin }
    });
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!locker){
      return NextResponse.json({ error: "Locker not found" }, { status: 404 });
    }

    // check if existing relationship between locker and user
    const isUserVerified = await prisma.userLocker.findFirst({
      where:{
        userId: uin, 
        lockerId: l_id
      }
    });

    // create log and return response based on verification result
    if (isUserVerified){
      console.log("authorized locker")
      create_audit_log(l_id, 'Locker_Opened', "Locker opened by user", uin )      
      return NextResponse.json({ message: "Authorized", name: user.name });
    }
    else if (await get_locker_state(locker) == "OCCUPIED"){
      console.log("denied locker")
      create_audit_log(l_id, 'Denied_Access', "Locker denied access to user", uin )      
      return NextResponse.json({ message: "Denied", name: user.name });
    }
    else{
      return NextResponse.json({ error: "Locker is not occupied" }, { status: 404 });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}