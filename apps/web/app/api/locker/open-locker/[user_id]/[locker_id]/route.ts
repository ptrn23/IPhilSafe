import { NextResponse } from 'next/server';
import { prisma } from '@repo/db';
import { create_audit_log } from '../../../../utils';
export async function POST(
    req: Request,
    { params }: { params: Promise<{ user_id:string, locker_id: string }> }

) {
  try {
    const { user_id, locker_id } = await params;
    // Strict check for the params
    if (!user_id || !locker_id) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }

    const uin = parseInt(user_id, 10)
    const l_id = parseInt(locker_id, 10)

    // check if user and locker exists
    const user = await prisma.user.findUnique({
      where: { uinPhilsys: uin }
    });
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!locker){
      return NextResponse.json({ error: "Locker not found" }, { status: 404 });
    }

    // check if existing relationship between locker and user
    const isUserVerified = await prisma.userLocker.findFirst({
      where:{
        userId: uin, 
        lockerId: l_id
      }
    });

    if (isUserVerified){
      console.log("authorized locker")
      create_audit_log(l_id, 'Locker_Accesed', "Locker opened by user", uin )      
      return NextResponse.json({ message: "Authorized", name: user.firstName });
    }
    else{
      console.log("desnied locker")
      create_audit_log(l_id, 'Locker_Accesed', "Locker denied access to user", uin )      
      return NextResponse.json({ message: "Denied", name: user.firstName });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}