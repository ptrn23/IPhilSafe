import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';
import { create_audit_log, get_locker_state } from '../../utils';
export async function POST(
    req: NextRequest,
) {
  try {
    // Adding a log here so you can see it in your VS Code terminal
    console.log("POST request received at /api/lockers/register");

    const {locker_id } = await req.json()
    // Strict check for the params
    if (locker_id == undefined || locker_id == null) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }

    const l_id = parseInt(locker_id, 10)
    // Check if locker id is a number (Note: 0 is a valid number!)
    if (isNaN(l_id)) {
      return NextResponse.json({ error: `Value ${l_id} is not a valid number` }, { status: 400 });
    }

    // check if locker exists
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });

    if (!locker){
      return NextResponse.json({ error:  `Locker ${l_id} not found` }, { status: 404 });
    }

    //check if locker is not in IDLE state
    const state = await get_locker_state(locker)
    if (state != "IDLE"){
      if(state == "REGISTER"){
        return NextResponse.json({ error: `Registration period has already started` }, { status: 409 });
      }
      return NextResponse.json({ error: "Locker is not in idle state" }, { status: 409 });
    }

    // if not, create log
    create_audit_log(l_id, 'Registration_Started', "Registration period started")

    return NextResponse.json({ message: "Registration start", lockerId: locker.lockerId }, { status: 200 });
  } catch (error) {
    console.error("Error in register route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}