"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NotificationRow = {
  id: number;
  type: string;
  severity: string;
  title: string;
  message?: string | null;
  href?: string | null;
  readAt?: string | null;
  createdAt?: string | null;
};

function timeLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function refresh() {
    try {
      const [countRes, feedRes] = await Promise.all([
        fetch("/api/notifications/unread-count", { cache: "no-store" }),
        fetch("/api/notifications", { cache: "no-store" }),
      ]);

      const countJson = await countRes.json().catch(() => ({}));
      const feedJson = await feedRes.json().catch(() => ({}));

      setCount(Number(countJson.count || 0));
      setNotifications(Array.isArray(feedJson.notifications) ? feedJson.notifications : []);
    } catch {
      setCount(0);
      setNotifications([]);
    }
  }

  async function markOneRead(id: number) {
    const now = new Date().toISOString();

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt: item.readAt || now } : item,
      ),
    );

    setCount((current) => Math.max(0, current - 1));

    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    }).catch(() => null);

    await refresh();
  }

  async function markAllRead() {
    setLoading(true);

    try {
      const now = new Date().toISOString();

      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      setCount(0);
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt || now,
        })),
      );

      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteNotification(id: number) {
    setDeletingId(id);

    try {
      const target = notifications.find((item) => item.id === id);
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });

      if (!res.ok) return;

      setNotifications((current) => current.filter((item) => item.id !== id));

      if (!target?.readAt) {
        setCount((current) => Math.max(0, current - 1));
      }
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-cyan-100 transition hover:bg-white/[0.08]"
        aria-label="Notifications"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {count > 0 ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-cyan-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-[390px] overflow-hidden rounded-3xl border border-white/10 bg-[#020617] shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
            <div>
              <p className="font-semibold text-white">Notifications</p>
              <p className="mt-1 text-sm text-slate-400">
                Governance activity and operational alerts
              </p>
            </div>

            <button
              type="button"
              onClick={markAllRead}
              disabled={loading || notifications.length === 0 || count === 0}
              className="text-sm font-medium text-slate-400 transition hover:text-white disabled:opacity-40"
            >
              {loading ? "Updating..." : "Mark all read"}
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notification) => {
                const unread = !notification.readAt;

                const content = (
                  <>
                    <div className="flex items-center gap-2">
                      {unread ? (
                        <span className="h-2 w-2 rounded-full bg-cyan-300" />
                      ) : null}

                      <p className={unread ? "font-semibold text-white" : "font-medium text-slate-300"}>
                        {notification.title}
                      </p>
                    </div>

                    {notification.message ? (
                      <p className={unread ? "mt-1 text-sm leading-6 text-slate-300" : "mt-1 text-sm leading-6 text-slate-500"}>
                        {notification.message}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-slate-500">
                      {timeLabel(notification.createdAt)}
                      {notification.readAt ? " · Read" : ""}
                    </p>
                  </>
                );

                return (
                  <div
                    key={notification.id}
                    className={[
                      "border-b border-white/10 p-5 last:border-b-0",
                      unread ? "bg-cyan-400/[0.04]" : "bg-transparent opacity-75",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {notification.href ? (
                        <Link
                          href={notification.href}
                          onClick={() => {
                            void markOneRead(notification.id);
                            setOpen(false);
                          }}
                          className="block flex-1 rounded-2xl transition hover:text-cyan-100"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void markOneRead(notification.id)}
                          className="block flex-1 rounded-2xl text-left transition hover:text-cyan-100"
                        >
                          {content}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => deleteNotification(notification.id)}
                        disabled={deletingId === notification.id}
                        className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

