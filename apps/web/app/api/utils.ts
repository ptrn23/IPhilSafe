import { prisma, Locker, sys_log_type } from "@repo/db";

export async function get_locker_state(l: Locker | null){
  if (!l){
    return null;
  }
  
  const last_log = await prisma.auditLog.findFirst({
  where: { lockerId: l.lockerId },
  orderBy: { createdAt: 'desc' },
  select: { sysType: true } // Avoid BigInt logId crash
  })
  // 4. Logic State
  let state = "IDLE";
  if (last_log?.sysType === 'Tampered') {
    state = "TAMPERED";
  } else if (last_log?.sysType === 'Registering' || last_log?.sysType === 'Added_user') {
    state = "REGISTER";
  } else if (l) {
    state = "OCCUPIED";
  }
  return state;
}

export async function create_audit_log(l_id: number, sys_type: sys_log_type, msg: string, user_id : number|null = null){
  await prisma.auditLog.create({
    data: { 
      lockerId: l_id, 
      sysType: sys_type, 
      logMsg: msg,
      user_id: user_id ?? null
    }
  });
}