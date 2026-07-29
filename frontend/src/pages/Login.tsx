interface LoginPageProps {
  readonly onLogin: () => Promise<void>;
  readonly isLoading: boolean;
}

export default function LoginPage({ onLogin, isLoading }: LoginPageProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0e0f17] relative overflow-hidden">

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#5865F2]/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#5865F2]/10 blur-3xl" />
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0e0f17]/90 backdrop-blur-sm">
          <div className="w-10 h-10 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-300 text-sm font-medium tracking-wide">
            Authenticating with Discord…
          </p>
        </div>
      )}

      {/* Glassmorphism card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div
          className="
            rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl
            shadow-[0_0_60px_rgba(88,101,242,0.15)]
            p-10 flex flex-col items-center text-center gap-6
          "
        >
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center shadow-lg shadow-[#5865F2]/20">
            <svg
              className="w-8 h-8 text-[#5865F2]"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              {/* Chat bubble icon */}
              <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-8 13H8v-2h4v2zm4-4H8V9h8v2z" />
            </svg>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Discord RAG Bot
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Log in to chat with your personal document knowledge base.
            </p>
          </div>

          {/* Discord login button */}
          <button
            id="btn-login-discord"
            onClick={onLogin}
            disabled={isLoading}
            className="
              w-full flex items-center justify-center gap-3
              bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3c45a5]
              disabled:opacity-60 disabled:cursor-not-allowed
              text-white font-semibold text-sm
              py-3 px-5 rounded-xl
              transition-all duration-200
              shadow-lg shadow-[#5865F2]/30 hover:shadow-[#5865F2]/50
            "
          >
            {/* Discord logo */}
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.036.055A19.9 19.9 0 0 0 5.997 20.7a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.026.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Login with Discord
          </button>

          <p className="text-xs text-slate-600">
            Your identity is used only to scope your documents.
          </p>
        </div>
      </div>
    </div>
  );
}
