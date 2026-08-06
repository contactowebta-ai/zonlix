import { Sidebar } from "@/components/shared/Sidebar";
import { PageTransition } from "@/components/shared/page-transition";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200">
      <Sidebar />
      <main className="bg-[#F8F9FA] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 min-h-screen w-full flex-1 p-8 overflow-y-auto">
        <PageTransition>
          <div className="mx-auto max-w-7xl">{children}</div>
        </PageTransition>
      </main>
    </div>
  );
}
