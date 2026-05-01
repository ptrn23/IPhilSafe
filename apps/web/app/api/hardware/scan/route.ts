import { NextResponse } from 'next/server';
import { prisma } from '@repo/db';

export async function POST(req: Request) {
  try {
    const { qrData, lockerId } = await req.json();

    const uin = parseInt(qrData);

    const user = await prisma.user.findUnique({
      where: { uinPhilsys: uin }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.userLocker.upsert({
      where: { userId_lockerId: { userId: uin, lockerId: Number(lockerId) } },
      update: {},
      create: { userId: uin, lockerId: Number(lockerId) }
    });

    return NextResponse.json({ message: "Authorized", name: user.firstName });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}