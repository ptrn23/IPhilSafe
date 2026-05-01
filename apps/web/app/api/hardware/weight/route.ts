import { NextResponse } from 'next/server';
import { prisma } from '@repo/db';

export async function POST(req: Request) {
  try {
    const { lockerId, weight } = await req.json();
    const lId = Number(lockerId);
    const newWeight = Math.round(Number(weight));

    // 1. Get the current locker data and check if a user is assigned
    const [currentLocker, userAssignment] = await Promise.all([
      prisma.locker.findUnique({ where: { lockerId: lId } }),
      prisma.userLocker.findFirst({ where: { lockerId: lId } })
    ]);

    if (!currentLocker) {
      return NextResponse.json({ error: "Locker not found" }, { status: 404 });
    }

    // 2. TAMPER DETECTION LOGIC
    // If there is a user (OCCUPIED) and the weight drops significantly (e.g., > 50g)
    // and the new weight is near 0, but they haven't checked out yet.
    const oldWeight = currentLocker.weight ?? 0;
    const weightDrop = oldWeight - newWeight;
    
    if (userAssignment && weightDrop > 50 && newWeight < 20) {
      console.log(`⚠️ TAMPER DETECTED on Locker ${lId}`);
      
      await prisma.auditLog.create({
        data: {
          lockerId: lId,
          sysType: 'Tampered',
          logMsg: `Suspicious weight drop from ${oldWeight}g to ${newWeight}g while occupied.`
        }
      });
      
      // Note: We don't return here; we still update the weight below 
      // so the DB reflects the current state of the scale.
    }

    // 3. Update the weight
    const result = await prisma.locker.update({
      where: { lockerId: lId },
      data: { weight: newWeight }
    });

    return NextResponse.json({ 
      status: "Weight Updated", 
      current: result.weight,
      tamperAlert: userAssignment && weightDrop > 50 && newWeight < 20 
    });

  } catch (e) {
    console.error("Weight Update Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}