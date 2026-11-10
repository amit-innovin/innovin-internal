import { WorkspacePage } from "@/components/workspace/page";

export const dynamic = "force-dynamic";

// The legacy workspace screen. It stays here only because it still hosts the notice board;
// it goes away when the Feed is rebuilt (see docs/design/canvas-map.md).
export default function Page() { return <WorkspacePage view="overview" />; }
