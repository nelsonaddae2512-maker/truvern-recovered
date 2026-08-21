import { NextResponse } from "next/server";
import { getDependencyAwareTestPlan, refreshDependencyAwareTestPlan } from "@/lib/atlas/test-planner";
export const dynamic = "force-dynamic";
export async function GET(){try{return NextResponse.json(getDependencyAwareTestPlan(),{headers:{"Cache-Control":"no-store"}})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Test planning failed."},{status:500})}}
export async function POST(){try{return NextResponse.json(refreshDependencyAwareTestPlan())}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Test plan refresh failed."},{status:500})}}
