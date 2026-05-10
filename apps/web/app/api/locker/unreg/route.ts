import { prisma } from '@repo/db';
import { NextResponse, NextRequest } from 'next/server';
import { create_audit_log, get_locker_state, isLockerClosed } from '../../utils';
export async function POST(
    req: NextRequest) {
  try {
    const { locker_id, weight, qr_data } = await req.json()
    
    if (!qr_data || locker_id == undefined || locker_id == null || weight == null || weight == undefined  ) {
      return NextResponse.json({ error: "Route parameter 'id' not found" }, { status: 400 });
    }
    const user_data = JSON.parse(qr_data);
    const uin = user_data.uin;
    const name = user_data.name;
    const l_id = parseInt(locker_id, 10)
    const w_new = parseInt(weight, 10)
    // Check if locker id is a number (Note: 0 is a valid number!)
    if (isNaN(l_id)) {
      return NextResponse.json({ error: `Value ${l_id} is not a valid number` }, { status: 400 });
    }
    if (isNaN(w_new)) {
      return NextResponse.json({ error: `Value ${w_new} is not a valid number` }, { status: 400 });
    }

    // // MOSIP verification
    // const mosipResult = await verifyWithMOSIP(JSON.stringify(user_data.subject));
    // if (mosipResult.status !== "verified"~) {
    //   return NextResponse.json({ error: `MOSIP verification failed: ${mosipResult.message || "Unknown error"}` }, { status: 401 });
    // }


    // Check if user and locker exists
    const user = await prisma.user.findUnique({
      where: { uinPhilsys: uin }
    });
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    if (!locker){
      return NextResponse.json({ error: `Locker ${l_id} not found` }, { status: 404 });
    }
    if (!user) {
      return NextResponse.json({ error: `User not found` }, { status: 404 });
    }

    // check if existing relationship between locker and user
    const isUserVerified = await prisma.userLocker.findFirst({
      where:{
        userId: uin, 
        lockerId: l_id
      }
    });
    if (!isUserVerified){
      return NextResponse.json({ error:  `User ${name} with uin ${uin} is not an owner for locker ${l_id}` }, { status: 401 });
    }
    
    // check if locker is closed
    if ((await isLockerClosed(locker)) == false){
      return NextResponse.json({ error:  `Locker ${l_id} is open` }, { status: 409 });
    }
    
    // check locker is in occupied state
    const cur_l_state = await get_locker_state(locker)
    if (cur_l_state != "OCCUPIED"){
      return NextResponse.json({ error: `Locker not OCCUPIED. In state ${cur_l_state}` }, { status: 409 });
    }

    // check if weight is within empty weight assumption
    const w_empty = 10
    if (w_new > w_empty){
      // udaptes current weight to not flag tamper detection
      await prisma.locker.update({
        where: { lockerId: l_id },
        data: { weight: w_new }
      });
      return NextResponse.json({ error: `Current weight ${weight}: All belongings haven't been cleared out of locker` }, { status: 409 });
    }
    
    // 1. Remove the user assignment (handleCheckout)
    // We use deleteMany because lockerId isn't the unique ID on its own in userLocker
    const res = await prisma.userLocker.deleteMany({ 
      where: { 
        lockerId: l_id
      } 
    });
    // Log the event
    create_audit_log(l_id, 'Unregister', 'User checked out and session cleared')

    // 3. Reset the locker weight to 0 or a baseline if needed
    await prisma.locker.update({
      where: { lockerId: l_id },
      data: { weight: 0 }
    });

    return NextResponse.json({ status: "Unregistration successful", removed:res });

  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: "Failed to checkout" }, { status: 500 });
  }
}