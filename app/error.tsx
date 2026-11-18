"use client";
import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { NoticeScreen } from "@/components/m3/notice-screen";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <NoticeScreen icon={<TriangleAlert size={24} />} title="Something went wrong"
      actions={<><button type="button" className="m3-btn m3-btn-filled" onClick={reset}>Try again</button><Link href="/" className="m3-btn m3-btn-text">Back to home</Link></>}>
      This page didn&apos;t load. Try again in a moment.
      {error.digest && <span className="m3-small" style={{ display: "block", marginTop: 4 }}>Reference: {error.digest}</span>}
    </NoticeScreen>
  );
}
