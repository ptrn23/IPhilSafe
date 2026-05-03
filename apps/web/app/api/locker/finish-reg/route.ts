import { prisma } from '@repo/db';
import { NextResponse, NextRequest } from 'next/server';
import { create_audit_log, get_locker_state, isLockerClosed } from '../../utils';
export async function POST(
    req: NextRequest) {
  try {
    const { locker_id, weight } = await req.json()
    if (locker_id == undefined || locker_id == null || weight == null || weight == undefined  ) {
      return NextResponse.json({ error: "Route parameter 'id' not found" }, { status: 400 });
    }
    const l_id = parseInt(locker_id, 10)
    const w_new = parseInt(weight, 10)
    
    // Check if locker exists
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    if (!locker){
      return NextResponse.json({ error: "Locker not found" }, { status: 404 });
    }        

    if (await get_locker_state(locker) != "REGISTER"){
      return NextResponse.json({ error: "Not in Registration Period" }, { status: 404 });
    }

    // check if no users added to locker
    const users = await prisma.userLocker.findFirst({
        where:{
            lockerId: l_id
        }
    })
    if (!users){
      create_audit_log(l_id, 'Registration_Finished', 'Registration Finished')
      return NextResponse.json({ error: "No users added " }, { status: 404 });
    }


    // Sets inital weight of locker
    const result = await prisma.locker.update({
      where: { lockerId: l_id },
      data: { weight: w_new }
    });

    create_audit_log(l_id, 'Registration_Finished', 'Registration Finished')
    create_audit_log(l_id, 'Locker_Opened', 'Lockers is opened after successful registration')

    return NextResponse.json({ status: "OCCUPIED" });

  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: "Failed to checkout" }, { status: 500 });
  }
}