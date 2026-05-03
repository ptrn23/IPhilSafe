import { NextResponse,NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { get_locker_state, create_audit_log } from '@/app/api/utils';

const w_threshold = 50

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
    const newWeight = Number(weight);

    // check if locker is existing
    const locker = await prisma.locker.findUnique({ where: { lockerId: l_id } })
    if (!locker) {
      return NextResponse.json({ error: "Locker not found" }, { status: 404 });
    }

    // check if locker is in occupied state
    if (await get_locker_state(locker) != "OCCUPIED"){
      return NextResponse.json({ error: "Locker not occupied" }, { status: 404 });
    }

    // tamper logic
    const oldWeight = locker.weight ?? 0;
    const weightDrop = Math.abs(oldWeight - newWeight);
    const isTampered = w_threshold < weightDrop
    if (isTampered) {
      // console.log(`⚠️ TAMPER DETECTED on Locker ${l_id}`);
      create_audit_log(l_id, 'Tampered', `Suspicious weight drop from ${oldWeight}g to ${newWeight}g while occupied`)      
    }

    // 3. Update the weight
    const result = await prisma.locker.update({
      where: { lockerId: l_id },
      data: { weight: newWeight }
    });

    return NextResponse.json({ 
      status: "Weight Updated", 
      current: result.weight,
      tamperAlert: isTampered
    });

  } catch (e) {
    console.error("Weight Update Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}