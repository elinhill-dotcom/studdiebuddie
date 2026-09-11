import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Ej behörig" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    displayName?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Ogiltig data" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const updates: {
      email?: string;
      password?: string;
      user_metadata?: { display_name: string };
    } = {};

    if (body.email?.trim()) updates.email = body.email.trim();
    if (body.password && body.password.length >= 6) {
      updates.password = body.password;
    }
    if (body.displayName?.trim()) {
      updates.user_metadata = { display_name: body.displayName.trim() };
    }

    if (Object.keys(updates).length) {
      const { error } = await supabase.auth.admin.updateUserById(id, updates);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    if (body.displayName?.trim()) {
      await supabase.from("profiles").upsert({
        id,
        display_name: body.displayName.trim(),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Serverfel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Ej behörig" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Serverfel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
