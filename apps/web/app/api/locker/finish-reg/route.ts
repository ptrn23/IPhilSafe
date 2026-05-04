import { prisma } from '@repo/db';
import { NextResponse, NextRequest } from 'next/server';
import { create_audit_log, get_locker_state, isLockerClosed } from '../../utils';
export async function POST(
    req: NextRequest) {
  try {
    const { locker_id } = await req.json()
    if (locker_id == undefined || locker_id == null  ) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }
    const l_id = parseInt(locker_id, 10)
    // Check if locker id is a number (Note: 0 is a valid number!)
    if (isNaN(l_id)) {
      return NextResponse.json({ error: `Value ${l_id} is not a valid number` }, { status: 400 });
    }
    
    // Check if locker exists
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    if (!locker){
      return NextResponse.json({ error: `Locker ${l_id} not found` }, { status: 404 });
    }    

    //check if locker is not in IDLE state
    const state = await get_locker_state(locker)
    if(state != "REGISTER"){
      return NextResponse.json({ error: `Not in Registration Period` }, { status: 409 });
    }

    // check if no users added to locker
    const users = await prisma.userLocker.findFirst({
        where:{
            lockerId: l_id
        }
    })
    if (!users){
      create_audit_log(l_id, 'Registration_Finished', 'Registration Finished')
      return NextResponse.json({ error: "No users added " }, { status: 409 });
    }

    create_audit_log(l_id, 'Registration_Finished', 'Registration Finished')
    create_audit_log(l_id, 'Locker_Opened', 'Lockers is opened after successful registration')

    return NextResponse.json({ message: "Successful registration", locker_id: l_id });

  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: "Failed to checkout" }, { status: 500 });
  }
}