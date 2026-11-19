import Link from "next/link";
import { Compass } from "lucide-react";
import { NoticeScreen } from "@/components/m3/notice-screen";

export default function NotFound() {
  return (
    <NoticeScreen icon={<Compass size={24} />} title="Page not found" actions={<Link href="/" className="m3-btn m3-btn-filled">Back to home</Link>}>
      That page doesn&apos;t exist or has moved.
    </NoticeScreen>
  );
}
