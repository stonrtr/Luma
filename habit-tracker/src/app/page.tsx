import { getState } from "@/lib/db";
import { StoreProvider } from "@/lib/store";
import { Desktop } from "@/components/Desktop";

export const dynamic = "force-dynamic";

export default function Page() {
  const initial = getState();
  return (
    <StoreProvider initial={initial}>
      <Desktop />
    </StoreProvider>
  );
}
