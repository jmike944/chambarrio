"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { UserEdit01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { WHITE_BUTTON } from "@/components/empresa/workwear";
import { useAllEmployerLocations } from "@/lib/store";
import { ROLE_RANK, updateMember, useMyMembership, validateMemberChange, type TeamMember, type TeamRole } from "@/lib/team";
import { cn } from "@/lib/utils";
import { DialogBody, FieldError, SUBMIT, TeamDialog } from "./dialog-shell";
import { BranchPicker, RolePicker } from "./role-fields";

/*
 * "Cambiar permisos" (dueño): a member's role and, for a reclutador, their branches. Mount it with a
 * `key` per member so it starts from their current values.
 */
export function MemberDialog({
  member,
  members,
  open,
  onOpenChange,
  returnFocus,
}: {
  member: TeamMember;
  members: TeamMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const my = useMyMembership();
  const branches = useAllEmployerLocations();
  const [role, setRole] = useState<TeamRole>(member.role);
  const [branchIds, setBranchIds] = useState<string[] | null>(member.role === "reclutador" ? member.branchIds : null);
  const [issue, setIssue] = useState<{ branches: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const errId = useId();
  const pickBranches = role === "reclutador" && branches.length > 1;
  const who = member.isMe ? "ti" : member.name.split(" ")[0] || member.email || "esta persona";
  // Nobody raises their own role (the database refuses it too).
  const disabled = member.isMe
    ? Object.fromEntries(
        (["reclutador", "admin", "dueno"] as TeamRole[])
          .filter((r) => ROLE_RANK[r] > ROLE_RANK[member.role])
          .map((r) => [r, "No puedes subir tu propio rol."]),
      )
    : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    // No picker (one branch): keep a reclutador's own limit instead of widening it to every branch.
    const kept = !pickBranches && role === "reclutador" && member.role === "reclutador" && member.branchIds?.length ? member.branchIds : null;
    const change = { role, branchIds: pickBranches ? branchIds : kept };
    const problem = validateMemberChange(member, change, { me: my.membership, members, companyBranchIds: branches.map((b) => b.id) });
    if (problem) {
      setIssue({ branches: problem.code === "bad_branches", message: problem.error });
      return;
    }
    setIssue(null);
    setBusy(true);
    const r = await updateMember(member.userId, change);
    setBusy(false);
    if (r.error) return; // toasted by the action
    toast.success(member.isMe ? "Guardamos tus permisos." : `Guardamos los permisos de ${who}.`);
    onOpenChange(false);
  }

  return (
    <TeamDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      returnFocus={returnFocus}
      tone="cielo"
      icon={UserEdit01Icon}
      title={member.isMe ? "Tus permisos" : `Permisos de ${who}`}
      description="Cambia qué puede hacer y de qué sucursales. Aplica en cuanto guardas."
    >
      <DialogBody
        onSubmit={submit}
        footer={
          <>
            {issue && !issue.branches ? <FieldError>{issue.message}</FieldError> : null}
            <div className={cn("grid grid-cols-2 gap-2.5", issue && !issue.branches && "mt-3")}>
              <Button type="button" size="lg" className={cn("h-12 font-bold", WHITE_BUTTON)} onClick={() => onOpenChange(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" aria-disabled={busy || undefined} className={cn(SUBMIT, "h-12")}>
                {busy ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </>
        }
      >
        <div className="space-y-5">
          <RolePicker
            value={role}
            disabled={disabled}
            onChange={(r) => {
              setRole(r);
              setIssue(null);
            }}
          />
          {pickBranches ? (
            <div>
              <BranchPicker
                value={branchIds}
                branches={branches}
                invalid={!!issue?.branches}
                errorId={errId}
                onChange={(ids) => {
                  setBranchIds(ids);
                  setIssue(null);
                }}
              />
              {issue?.branches ? <FieldError id={errId}>{issue.message}</FieldError> : null}
            </div>
          ) : null}
        </div>
      </DialogBody>
    </TeamDialog>
  );
}
