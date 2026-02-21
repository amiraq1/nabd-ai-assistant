import { Menu } from "lucide-react";

interface NabdHeaderProps {
  onToggleSidebar: () => void;
  conversationTitle?: string;
}

export function NabdHeader({ onToggleSidebar, conversationTitle }: NabdHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-2 px-5 py-3.5 border-b border-white/5"
      style={{ background: "#0a0a0a" }}
      data-testid="header"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-white" />
          <h1 className="text-lg font-bold text-white tracking-tight">
            نبض
          </h1>
        </div>
        {conversationTitle && (
          <>
            <span className="text-white/15">|</span>
            <span className="text-sm text-white/40 truncate max-w-48">{conversationTitle}</span>
          </>
        )}
      </div>
      <button
        className="flex items-center justify-center w-9 h-9 rounded-xl text-white/50 transition-colors hover:text-white/80 hover:bg-white/5"
        onClick={onToggleSidebar}
        data-testid="button-toggle-sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>
    </header>
  );
}
