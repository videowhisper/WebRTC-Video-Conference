import { t } from "../config/labels";
import ThemeToggle from './ThemeToggle';
import { AlertCircle } from 'lucide-react';
export default function StatusView({
  title,
  message,
  icon
}) {
  return <main className="vwc-app flex min-h-screen items-center justify-center vwc-background px-4 vwc-text">
      <section className="w-full max-w-md rounded-lg border vwc-border vwc-surface p-6 text-center shadow-2xl">
        <div className="flex justify-end"><ThemeToggle /></div>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-amber-300">
          {icon || <AlertCircle className="h-7 w-7" />}
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 vwc-secondary">{message || t("Unknown status.")}</p>
      </section>
    </main>;
}
