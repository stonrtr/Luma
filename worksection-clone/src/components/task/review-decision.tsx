"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Undo2 } from "lucide-react";
import { reviewTask } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Панель проверки для руководителя: принять или вернуть на доработку с обязательной причиной.
export function ReviewDecision({ taskId }: { taskId: string }) {
  const router = useRouter();
  const tr = useT();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    start(async () => {
      const r = await reviewTask({ taskId, decision: "approve" });
      if (r?.error) toast.error(r.error);
      else { toast.success(tr("rb.approved")); router.refresh(); }
    });
  }

  function submitReject() {
    if (!reason.trim()) { toast.error(tr("rb.reasonRequired")); return; }
    start(async () => {
      const r = await reviewTask({ taskId, decision: "reject", comment: reason });
      if (r?.error) toast.error(r.error);
      else { toast.success(tr("rb.returned")); setRejecting(false); setReason(""); router.refresh(); }
    });
  }

  if (rejecting) {
    return (
      <div className="space-y-2">
        <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={tr("rb.reasonPh")} />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={pending || !reason.trim()} onClick={submitReject}>
            <Undo2 className="size-4" /> {tr("rb.returnSubmit")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => { setRejecting(false); setReason(""); }}>
            {tr("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" className="flex-1" disabled={pending} onClick={approve}>
        <Check className="size-4" /> {tr("rb.approve")}
      </Button>
      <Button size="sm" variant="outline" className="flex-1" disabled={pending} onClick={() => setRejecting(true)}>
        <Undo2 className="size-4" /> {tr("rb.return")}
      </Button>
    </div>
  );
}
