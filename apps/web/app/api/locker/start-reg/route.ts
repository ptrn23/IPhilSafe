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
    if (!locker_id) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }

    const l_id = parseInt(locker_id, 10)

    // check if locker exists
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });

    if (!locker){
      return NextResponse.json({ error: "Locker not found" }, { status: 404 });
    }

    //check if locker is in IDLE state
    if (await get_locker_state(locker) != "IDLE"){
      return NextResponse.json({ error: "Locker is not in idle state" }, { status: 404 });
    }

    // check if already in registering period
    if(await get_locker_state(locker) == "REGISTER"){
      return NextResponse.json({ error: `Registration period has already started` }, { status: 404 });
    }

    // if not, create log
    create_audit_log(l_id, 'Registration_Started', "Registration period started")

    return NextResponse.json({ message: "Regsitration start", lockerId: locker.lockerId }, { status: 201 });
  } catch (error) {
    console.error("Error in register route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}