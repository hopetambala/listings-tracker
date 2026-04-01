"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/admin");
        return;
      }
      setUser(user);
      setLoading(false);
    };
    checkAuth();
  }, [router, supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <main className="page page--centered">
        <dl-spinner />
      </main>
    );
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "40rem" }}>
        <div className="cl-dlite-flex cl-dlite-items-center cl-dlite-justify-between cl-dlite-sem-mb-600">
          <dl-heading level={1}>Dashboard</dl-heading>
          <dl-button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign Out
          </dl-button>
        </div>

        <dl-card>
          <div style={{ padding: "2rem" }}>
            <dl-heading level={2}>Welcome, Admin</dl-heading>
            <dl-text style={{ marginTop: "1rem", marginBottom: "2rem" }}>
              Email: <strong>{user?.email}</strong>
            </dl-text>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <dl-button variant="primary" full-width onClick={() => router.push("/admin/properties")}>
                Manage Properties
              </dl-button>
              <dl-button variant="secondary" full-width onClick={() => router.push("/admin/bulk-upload")}>
                Bulk Upload CSV
              </dl-button>
            </div>
          </div>
        </dl-card>

        <div className="cl-dlite-text-center cl-dlite-sem-mt-600">
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/")}>
            ← Back to Home
          </dl-button>
        </div>
      </div>
    </main>
  );
}
