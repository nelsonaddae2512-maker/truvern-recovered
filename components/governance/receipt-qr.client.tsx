"use client";

import { QRCodeSVG } from "qrcode.react";

export default function ReceiptQr({
  value,
}: {
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white p-4">
      <QRCodeSVG value={value} size={180} />
    </div>
  );
}
