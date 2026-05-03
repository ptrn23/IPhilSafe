import { NextResponse, NextRequest} from 'next/server';
import { prisma } from '@repo/db';
import { create_audit_log, verifyWithMOSIP } from '../../utils';
export async function POST(
    req: NextRequest
) {
  try {
    const { qrData, locker_id } = await req.json();
    // 2. Strict check for the ID
    if (!qrData || !locker_id ) {
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

    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    let user = await prisma.user.findUnique({
      where: { uinPhilsys: uin }
    });

    // check if locker exists
    if (!locker){
      return NextResponse.json({ error: `Locker ${l_id} not found` }, { status: 404 });
    }

    // create user if it does not exist
    if (!user) {
      user = await prisma.user.create({
        data: { 
          uinPhilsys: uin, 
          name: name, 
          userRole: "User" }
      });
    }

    // check if in registering period
    const latestRegLog = await prisma.auditLog.findFirst({
      where: {
        lockerId: l_id, 
        sysType: "Registering"
      },
      orderBy: {createdAt: "desc"},
    })

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (latestRegLog?.createdAt && latestRegLog.createdAt > fiveMinutesAgo){
      return NextResponse.json({ error: `Past Registration period or registration hasn't started` }, { status: 404 });
    }

    // check for duplicates already added
    const isAdded = await prisma.userLocker.findFirst({
      where: {
        lockerId: l_id,
        userId: uin
      }
    })
    if (isAdded){
      return NextResponse.json({ error: `User ${name} with uin ${uin} is already a user for locker ${l_id}` }, { status: 404 });
    }

    // add user to locker
    await prisma.userLocker.create({
      data: { 
        userId: uin, 
        lockerId: l_id }
    });

    // create log
    create_audit_log(l_id, 'Added_user', "New user added", uin);
    
    return NextResponse.json({ message: `user, ${name} with uin ${uin}, has been added as user to locker ${l_id}`});
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}