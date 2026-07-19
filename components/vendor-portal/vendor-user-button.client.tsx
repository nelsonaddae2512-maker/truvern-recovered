// components/vendor-portal/vendor-user-button.client.tsx
"use client";

import { UserButton } from "@clerk/nextjs";

export default function VendorPortalUserButton() {
  return (
    <div className="flex items-center">
      <UserButton afterSignOutUrl="/" />
    </div>
  );
}

