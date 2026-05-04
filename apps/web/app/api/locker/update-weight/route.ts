import { NextResponse,NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { get_locker_state, create_audit_log } from '@/app/api/utils';

const tamper_threshold = 50

export async function POST(
    req: NextRequest
) {
  try {
    const { locker_id, weight } = await req.json()
    // Strict check for the params
    if (locker_id == undefined || locker_id == null || weight == null || weight == undefined  ) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }

    const l_id = Number(locker_id);
    const w_new = Number(weight);
    // Check if weight and locker id is a number (Note: 0 is a valid number!)
    if (isNaN(w_new)) {
      return NextResponse.json({ error: `Value ${w_new} is not a valid number` }, { status: 400 });
    }
    if (isNaN(l_id)) {
      return NextResponse.json({ error: `Value ${l_id} is not a valid number` }, { status: 400 });
    }

    // check if locker is existing
    const locker = await prisma.locker.findUnique({ where: { lockerId: l_id } })
    if (!locker) {
      return NextResponse.json({ error: `Locker ${l_id} not found` }, { status: 404 });
    }

    // check if locker is in occupied state
    const cur_l_state = await get_locker_state(locker)
    if (cur_l_state != "OCCUPIED"){
      return NextResponse.json({ error: `Locker not OCCUPIED. In state ${cur_l_state}` }, { status: 409 });
    }

    // tamper logic
    const oldWeight = locker.weight ?? 0;
    const weightDrop = Math.abs(oldWeight - w_new);
    const isTampered = tamper_threshold < weightDrop
    if (isTampered) {
      // console.log(`⚠️ TAMPER DETECTED on Locker ${l_id}`);
      create_audit_log(l_id, 'Tampered', `Suspicious weight drop from ${oldWeight}g to ${w_new}g while occupied`)      
    }

    // 3. Update the weight
    const result = await prisma.locker.update({
      where: { lockerId: l_id },
      data: { weight: w_new }
    });

    return NextResponse.json({ 
      message: "Weight Updated", 
      current_weight: result.weight,
      tamperAlert: isTampered 
    });

  } catch (e) {
    console.error("Weight Update Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}