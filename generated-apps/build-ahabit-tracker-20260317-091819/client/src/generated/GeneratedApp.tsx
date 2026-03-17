import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { habitsApi } from "./generated-api-client";

function PreviewCanvas() {
  return (
    <div className={"min-h-screen flex w-full flex-col bg-gray-100"}>
      <div className={"p-4"}>
        <span className={"text-3xl font-bold"}>
          {"Build A Habit Tracker"}
        </span>
      </div>
      <div className={"flex-1 overflow-y-scroll"}>
        <div className={"p-4"}>
          <span className={"text-lg font-bold"}>
            {"Habits"}
          </span>
          <div className={"mt-4"}>
            <button type="button" className={"bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"}>
              {"Create Habit"}
            </button>
          </div>
          <div className={"mt-4"}>
            <span className={"text-lg font-bold"}>
              {"Habit List"}
            </span>
            <div className={"mt-4"}>
              <div className={"flex flex-col"}>
                <div className={"flex flex-row justify-between p-2"}>
                  <span className={"text-lg"}>
                    {"Habit Name"}
                  </span>
                  <span className={"text-lg"}>
                    {"Streak"}
                  </span>
                </div>
                <div className={"flex flex-col"}>
                  <div className={"flex flex-row justify-between p-2"}>
                    <span className={"text-lg"}>
                      {"Habit 1"}
                    </span>
                    <span className={"text-lg"}>
                      {"10 days"}
                    </span>
                  </div>
                  <div className={"flex flex-row justify-between p-2"}>
                    <span className={"text-lg"}>
                      {"Habit 2"}
                    </span>
                    <span className={"text-lg"}>
                      {"5 days"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

function DashboardData() {
  const query = useQuery({ queryKey: ["habits"], queryFn: habitsApi.list });
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-semibold text-white">Habits</h2>
      <pre className="mt-4 overflow-auto rounded-2xl bg-black/30 p-4 text-xs text-emerald-200">{JSON.stringify(query.data ?? [], null, 2)}</pre>
    </section>
  );
}

function Shell() {
  return (
    <div className="min-h-screen bg-stone-950 p-6 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6"><PreviewCanvas /></div>
        <div className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <h1 className="text-3xl font-semibold tracking-tight">BuildAHabitTracker</h1>
            <p className="mt-3 text-sm leading-7 text-white/70">Build a habit tracker app with CRUD API, streak metrics, and a responsive dashboard.</p>
          </section>
          <DashboardData />
        </div>
      </div>
    </div>
  );
}

export default function GeneratedAppShell() {
  return <QueryClientProvider client={queryClient}><Shell /></QueryClientProvider>;
}