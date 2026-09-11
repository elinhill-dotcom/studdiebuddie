import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Ej behörig" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.auth.admin.listUsers({
      perPage: 200,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = data.users.map((u) => u.id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const nameById = new Map(
      (profiles || []).map((p) => [p.id, p.display_name as string]),
    );

    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email || "",
      displayName:
        nameById.get(u.id) ||
        (u.user_metadata?.display_name as string | undefined) ||
        "Buddie",
      createdAt: u.created_at,
    }));

    return NextResponse.json({ users });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Serverfel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Ej behörig" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    displayName?: string;
  } | null;

  const email = body?.email?.trim();
  const password = body?.password || "";
  const displayName = body?.displayName?.trim() || "Buddie";

  if (!email || password.length < 6) {
    return NextResponse.json(
      { error: "E-post och lösenord (minst 6 tecken) krävs" },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || "Kunde inte skapa konto" },
        { status: 400 },
      );
    }

    await supabase.from("profiles").upsert({
      id: data.user.id,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      user: {
        id: data.user.id,
        email,
        displayName,
        createdAt: data.user.created_at,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Serverfel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
