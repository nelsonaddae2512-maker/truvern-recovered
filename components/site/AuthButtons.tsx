
'use client';
import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export function AuthButtons(){
  const { data } = useSession();
  if(!data?.user){
    return <Link href="/login" className="h-9 px-3 rounded bg-slate-900 text-white">Login</Link>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600 hidden md:inline">Hi, {(data.user as any).name || data.user.email}</span>
      <button onClick={()=>signOut({ callbackUrl: '/' })} className="h-9 px-3 rounded border">Logout</button>
    </div>
  );
}



