import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface AudioDropWrapperProps {
  onFile: (file: File) => void;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const AudioDropWrapper: React.FC<AudioDropWrapperProps> = ({
  onFile,
  className = "",
  children,
  disabled = false
}) => {
  const handleDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (file) {
        onFile(file);
      }
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: { "audio/*": [] },
    onDropAccepted: handleDrop,
    disabled
  });

  return (
    <div
      {...getRootProps({
        className: `${className} ${isDragActive && !disabled ? "drag-hover" : ""}`.trim()
      })}
    >
      <input {...getInputProps()} />
      {children}
    </div>
  );
};
