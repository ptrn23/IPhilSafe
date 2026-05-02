import { prisma } from "@repo/db";


export async function get_locker_state(l){
  if (!l){
    return null;
  }
  
  const last_log = await prisma.auditLog.findFirst({
  where: { lockerId: l.locker_id },
  orderBy: { createdAt: 'desc' },
  select: { sysType: true } // Avoid BigInt logId crash
  })
  
  // 4. Logic State
  let state = "IDLE";
  if (last_log?.sysType === 'Tampered') {
    state = "TAMPERED";
  } else if (l) {
    state = "OCCUPIED";
  }
  return state;
}

export async function create_audit_log(l_id, sys_type, msg, user_id : Number|null = null){
  await prisma.auditLog.create({
    data: { 
      lockerId: parseInt(l_id), 
      sysType: sys_type, 
      logMsg: msg,
      user_id: user_id
    }
  });
}