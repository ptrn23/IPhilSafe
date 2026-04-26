import { prisma } from "@repo/db";
export async function GET() {
  console.log("API HIT--------------------------------------------------------------------------------------");
  try{
    const users = await prisma.user.findMany();

    return Response.json(users);

  }
  catch(err){
    console.log("DB response error");
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
      }
  
}