import { getSnapshot } from "@/lib/indicators";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <Dashboard initial={await getSnapshot()} />;
}
