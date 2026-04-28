import { prisma } from '@repo/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { lockerId } = await req.json();

    // 1. Remove the user assignment (handleCheckout)
    // We use deleteMany because lockerId isn't the unique ID on its own in userLocker
    await prisma.userLocker.deleteMany({ 
      where: { 
        lockerId: parseInt(lockerId) 
      } 
    });

    // 2. Log the cleanup event (clean() and return to IDLE)
    await prisma.auditLog.create({
      data: { 
        lockerId: parseInt(lockerId), 
        sysType: 'Unregister', 
        logMsg: 'User checked out and session cleared' 
      }
    });

    // 3. Reset the locker weight to 0 or a baseline if needed
    await prisma.locker.update({
      where: { lockerId: parseInt(lockerId) },
      data: { weight: 0 }
    });

    return NextResponse.json({ status: "IDLE" });

  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: "Failed to checkout" }, { status: 500 });
  }
}