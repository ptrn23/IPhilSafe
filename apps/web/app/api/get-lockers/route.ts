import { NextRequest, NextResponse } from 'next/server';
import { prisma, Locker } from "@repo/db";
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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // get lockers
    const lockers =  (user.userRole == "Admin") // all locker if admin
                    ? await prisma.locker.findMany({
                      select:{
                        lockerId: true,
                        weight: true,
                        users: {
                          select: {
                            user:{
                              select:{
                                name: true,
                                uinPhilsys: true
                              }
                            }
                          },
                          orderBy:{
                            user:{
                              name:`asc`
                            }
                          }
                        }
                      },
                      orderBy:{
                        lockerId: `asc`
                      }
                    }) 
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
                        orderBy:{
                          lockerId: `asc`
                        }
                      })
                      : null;
    if (!lockers){
      return NextResponse.json([]);  
    }
    // get locker states
    const res = await Promise.all(
      lockers.map(async (l:any) => {
        return {
        locker_id : l.lockerId,
        weight : l.weight,
        status : await get_locker_state(l),
        users: l.users ?? []
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