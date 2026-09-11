"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { notifyDataChanged } from "@/components/useAppData";
import { loadData, registerCloudSync, saveData } from "@/lib/store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  deleteCalendarEventFromCloud,
  deleteHomeworkFromCloud,
  deleteNoteFromCloud,
  deleteReminderFromCloud,
  deleteVocabListFromCloud,
  loadCloudAppData,
  pushLocalDataToCloud,
  syncCalendarEventToCloud,
  syncExamResultToCloud,
  syncHomeworkToCloud,
  syncNoteToCloud,
  syncProfileToCloud,
  syncQuizSessionToCloud,
  syncReminderToCloud,
  syncVocabListToCloud,
} from "@/lib/supabase/sync";
import type { AppData } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  syncing: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshFromCloud: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function hasContent(data: AppData) {
  return (
    data.homeworks.length > 0 ||
    data.notes.length > 0 ||
    data.calendarEvents.length > 0 ||
    data.reminders.length > 0 ||
    data.vocabLists.length > 0 ||
    data.quizSessions.length > 0 ||
    data.examResults.length > 0
  );
}

function cloudLooksEmpty(data: AppData) {
  return !hasContent(data);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [syncing, setSyncing] = useState(false);

  const hydrateFromCloud = useCallback(async (u: User) => {
    setSyncing(true);
    try {
      const cloud = await loadCloudAppData(u);
      if (!cloud) return;

      const local = loadData();
      if (cloudLooksEmpty(cloud) && hasContent(local)) {
        await pushLocalDataToCloud(local, u);
        notifyDataChanged();
        return;
      }

      if (!cloudLooksEmpty(cloud)) {
        saveData(cloud);
        notifyDataChanged();
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      registerCloudSync(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const u = data.session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u) void hydrateFromCloud(u);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (event === "SIGNED_IN" && u) {
        void hydrateFromCloud(u);
      }
      if (event === "SIGNED_OUT") {
        registerCloudSync(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured, hydrateFromCloud]);

  useEffect(() => {
    if (!user) {
      registerCloudSync(null);
      return;
    }

    registerCloudSync({
      onHomeworkUpsert: (hw) => void syncHomeworkToCloud(hw, user),
      onHomeworkDelete: (id) => void deleteHomeworkFromCloud(id),
      onNoteUpsert: (n) => void syncNoteToCloud(n, user),
      onNoteDelete: (id) => void deleteNoteFromCloud(id),
      onCalendarUpsert: (e) => void syncCalendarEventToCloud(e, user),
      onCalendarDelete: (id) => void deleteCalendarEventFromCloud(id),
      onReminderUpsert: (r) => void syncReminderToCloud(r, user),
      onReminderDelete: (id) => void deleteReminderFromCloud(id),
      onVocabUpsert: (v) => void syncVocabListToCloud(v, user),
      onVocabDelete: (id) => void deleteVocabListFromCloud(id),
      onQuizUpsert: (q) => void syncQuizSessionToCloud(q, user),
      onExamUpsert: (e) => void syncExamResultToCloud(e, user),
      onProfileChange: (name, modules, notifications) =>
        void syncProfileToCloud(user, name, modules, notifications),
    });
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createClient();
    if (!supabase) return "Supabase är inte konfigurerat.";
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const supabase = createClient();
      if (!supabase) return "Supabase är inte konfigurerat.";
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() || "Buddie" },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return error?.message ?? null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshFromCloud = useCallback(async () => {
    if (!user) return;
    await hydrateFromCloud(user);
  }, [hydrateFromCloud, user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured,
      syncing,
      signIn,
      signUp,
      signOut,
      refreshFromCloud,
    }),
    [
      user,
      loading,
      configured,
      syncing,
      signIn,
      signUp,
      signOut,
      refreshFromCloud,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth måste användas inom AuthProvider");
  }
  return ctx;
}
