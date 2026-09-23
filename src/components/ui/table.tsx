"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { DotsThree, PencilSimple, Trash } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("eyebrow py-3 text-[10.5px] font-normal", className)}>
      {children}
    </th>
  );
}

export function RowMenu({
  onEdit,
  onDelete,
  label,
  editLabel = "Edit",
  deleteLabel = "Remove",
}: {
  onEdit: () => void;
  onDelete: () => void;
  label: string;
  editLabel?: string;
  deleteLabel?: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <DotsThree size={18} weight="bold" />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-40 rounded-md border border-line bg-surface p-1 shadow-float animate-[rise_140ms_ease-out]"
        >
          <Menu.Item
            onSelect={onEdit}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2"
          >
            <PencilSimple size={15} /> {editLabel}
          </Menu.Item>
          <Menu.Item
            onSelect={onDelete}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-danger outline-none data-[highlighted]:bg-danger-wash"
          >
            <Trash size={15} /> {deleteLabel}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

