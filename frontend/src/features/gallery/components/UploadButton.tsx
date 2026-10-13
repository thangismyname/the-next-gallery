import { UploadProgress } from "@/types"; // hoặc "../../../types" nếu chưa có alias @/
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadMediaInBatches } from "../../../services/api";

interface UploadButtonProps {
  onUploaded: () => void; // gọi lại để GalleryView refetch danh sách media
}

export const UploadButton: React.FC<UploadButtonProps> = ({ onUploaded }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setProgress({
      uploadedCount: 0,
      totalCount: files.length,
      currentBatchPercent: 0,
    });

    try {
      await uploadMediaInBatches(Array.from(files), (p) => setProgress(p));
      onUploaded();
    } catch (err) {
      console.error("Upload thất bại:", err);
      setError(t("gallery.error.uploadFailed"));
    } finally {
      setUploading(false);
      setProgress(null);
      // reset input để chọn lại cùng file (nếu cần) vẫn trigger onChange
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // % tổng thể = (số file đã xong toàn batch trước + % file đang chạy trong batch hiện tại) / tổng
  const overallPercent = progress
    ? Math.min(
        100,
        Math.round(
          ((progress.uploadedCount + progress.currentBatchPercent / 100) /
            progress.totalCount) *
            100,
        ),
      )
    : 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        size="sm"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading ? t("gallery.upload.uploading") : t("gallery.upload.button")}
      </Button>

      {uploading && progress && (
        <div className="w-48">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>
              {progress.uploadedCount}/{progress.totalCount}
            </span>
            <span>{overallPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-[width] duration-150 ease-out"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      )}

      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
};
