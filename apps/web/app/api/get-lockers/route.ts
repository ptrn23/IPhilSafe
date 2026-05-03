import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@repo/db";
import { get_locker_state } from "../utils";

export async function POST(
    req: NextRequest,
) {
  try {
    const {user_id}  = await req.json()
    // 2. Strict check for the ID
    if (!user_id) {
      return NextResponse.json({ error: "Route parameter id not found" }, { status: 400 });
    }

    console.log("Locker data accessed by user:", user_id);

    // check if user in database
    const user = await prisma.user.findFirst({
      where: { uinPhilsys: user_id }
    });

    if (user === undefined || user === null) {
      return NextResponse.json({ error: "No user in the database" }, { status: 400 });
    }

    // get lockers
    const lockers =  (user.userRole == "Admin") // all locker if admin
                    ? await prisma.locker.findMany() 
                    : (user.userRole == "User") // all locker of user only if user
                    ? await prisma.locker.findMany({
                        where: {
                          users:{
                            some:{
                              userId: user.uinPhilsys
                            }
                          }
                        },
                        select: {
                          lockerId: true,
                          weight: true,
                        },
                      })
                      : null;
    if (!lockers){
      return NextResponse.json([]);  
    }
    // get locker states
    const res = await Promise.all(
      lockers.map(async (l) => {
        return {
        locker_id : l.lockerId,
        weight : l.weight,
        status : get_locker_state(l),
        }
      })
    ) 

    return NextResponse.json(res);     
  } catch (err) {
    console.error("Status Route Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}