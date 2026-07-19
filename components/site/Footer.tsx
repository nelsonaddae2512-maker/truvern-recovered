export default function Footer() {
  return (
    <footer className="mt-24 border-t bg-white">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-600 grid gap-6 sm:grid-cols-3">
        <div>
          <div className="font-semibold text-zinc-900">Truvern</div>
          <p className="mt-2">Assess, compare, and monitor third-party vendors.</p>
        </div>
        <div>
          <div className="font-semibold text-zinc-900">Product</div>
          <ul className="mt-2 space-y-1">
            <li><a href="/trust" className="hover:underline">Trust Network</a></li>
            <li><a href="/assessment" className="hover:underline">Assessments</a></li>
            <li><a href="/compare" className="hover:underline">Compare vendors</a></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-zinc-900">Company</div>
          <ul className="mt-2 space-y-1">
            <li><a href="/legal/terms" className="hover:underline">Terms</a></li>
            <li><a href="/legal/privacy" className="hover:underline">Privacy</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-zinc-500">© {new Date().getFullYear()} Truvern</div>
    </footer>
  );
}

