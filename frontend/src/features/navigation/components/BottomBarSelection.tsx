// features/navigation/components/BottomBarSelection.tsx
import React from "react";
import { SelectionActionBar } from "@/features/gallery/components/SelectionActionBar";

interface BottomBarSelectionProps {
  onShare: (ids: string[]) => void;
  onDownload: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
  onFavorite: (ids: string[]) => void;
}

export const BottomBarSelectionActions: React.FC<BottomBarSelectionProps> = ({
  onShare,
  onDownload,
  onDelete,
  onFavorite,
}) => {
  return (
    <SelectionActionBar
      onShare={onShare}
      onDownload={onDownload}
      onDelete={onDelete}
      onFavorite={onFavorite}
    />
  );
};