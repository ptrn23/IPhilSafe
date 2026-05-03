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
    
    // check if locker is closed
    if ((await isLockerClosed(locker)) == false){
      return NextResponse.json({ error: "Locker is not closed" }, { status: 404 });
    }
    
    // check locker is in occupied state
    const cur_l_state = await get_locker_state(locker)
    if (cur_l_state != "OCCUPIED"){
      return NextResponse.json({ error: `Locker not occupied in state ${cur_l_state}` }, { status: 404 });
    }

    // check if weight is within empty weight assumption
    const w_empty = 10
    if (isNaN(w_new)){
      return NextResponse.json({ error: `Weight is not a number ${weight}` }, { status: 404 });
    }

    if (w_new > w_empty){
      // udaptes current weight to not flag tamper detection
      await prisma.locker.update({
        where: { lockerId: l_id },
        data: { weight: w_new }
      });
      return NextResponse.json({ error: `Current weight ${weight}: All belongings haven't been cleared out of locker` }, { status: 404 });
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

    return NextResponse.json({ status: "IDLE", removed:res });

  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: "Failed to checkout" }, { status: 500 });
  }
}