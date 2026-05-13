import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { create_audit_log, isLockerClosed} from '../../utils';
export async function POST(
    req: NextRequest,

) {
  try {
    const { weight, locker_id } = await req.json();
    // Strict check for the params
    if (locker_id == undefined || locker_id == null || weight == null || weight == undefined  ) {
      return NextResponse.json(
        { error: "Route parameters not found" }, 
        { status: 400 }
      );
    } 

    const w_new = parseInt(weight, 10)
    const l_id = parseInt(locker_id, 10)
    // Check if weight and locker id is a number (Note: 0 is a valid number!)
    if (isNaN(w_new)) {
      return NextResponse.json(
        { error: `Value ${w_new} is not a valid number` }, 
        { status: 400 }
      );
    }
    if (isNaN(l_id)) {
      return NextResponse.json(
        { error: `Value ${l_id} is not a valid number` }, 
        { status: 400 })
        ;
    }

    // check if locker exists
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    if (!locker){ 
      return NextResponse.json(
        { error: `Locker ${l_id} not found` }, 
        { status: 404 }
      );
    }

    if(await isLockerClosed(locker) ){
      return NextResponse.json(
        { error: `Locker ${l_id} already closed` }, 
        { status: 409 }
      );
    }

    // Update weight to bypass tamper detection
    const result = await prisma.locker.update({
      where: { lockerId: l_id },
      data: { weight: w_new }
    });

    // create audit log
    create_audit_log(l_id, "Locker_Closed", "Locker is closed")
    return NextResponse.json({ 
      status: "Weight Updated", 
      current_weight: result.weight,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}