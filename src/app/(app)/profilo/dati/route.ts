import { NextResponse, type NextRequest } from "next/server";
import { toDateFieldValue } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { buildExport } from "./build";

/*
 * «I tuoi dati» (#38): the file with everything the person put in. POST only
 * (any other method answers 405), and a POST from another site is refused
 * (403), like `/auth/signout`. It is prepared with the person's own session,
 * so the rules of the database decide what can be read. The content never goes
 * to the logs and is never kept: `no-store`.
 */
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403, headers: NO_STORE });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json(
        { ok: false },
        { status: 401, headers: NO_STORE },
      );
    }
    const user = data.user;
    const now = new Date();
    const file = await buildExport(
      supabase,
      {
        id: user.id,
        email: user.email ?? null,
        providers: (user.identities ?? []).map((i) => i.provider),
      },
      now,
    );
    if (!file) {
      return NextResponse.json(
        { ok: false },
        { status: 500, headers: NO_STORE },
      );
    }
    return new NextResponse(JSON.stringify(file, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="familynest-i-tuoi-dati-${toDateFieldValue(now)}.json"`,
        ...NO_STORE,
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
  }
}
