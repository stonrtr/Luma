import { getState } from "@/lib/db";
import { StoreProvider } from "@/lib/store";
import { ConfirmProvider } from "@/components/confirm";
import { Desktop } from "@/components/Desktop";

export const dynamic = "force-dynamic";

export default function Page() {
  const initial = getState();
  return (
    <StoreProvider initial={initial}>
      <ConfirmProvider>
        <Desktop />
      </ConfirmProvider>
    </StoreProvider>
  );
}
