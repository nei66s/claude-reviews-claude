"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type FileActionModalProps = {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export default function FileActionModal({
  isOpen,
  title,
  label,
  placeholder,
  defaultValue = "",
  onConfirm,
  onCancel,
}: FileActionModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Focus input after modal mounts
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      setValue("");
    }
  };

  const handleCancel = () => {
    setValue("");
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="file-action-modal-backdrop" onClick={handleCancel} />

      {/* Modal */}
      <div className="file-action-modal">
        <div className="file-action-modal-header">
          <h2 className="file-action-modal-title">{title}</h2>
          <button
            type="button"
            className="file-action-modal-close"
            onClick={handleCancel}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="file-action-modal-body">
          <label className="file-action-modal-label">{label}</label>
          <input
            ref={inputRef}
            type="text"
            className="file-action-modal-input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="file-action-modal-footer">
          <button
            type="button"
            className="file-action-modal-button-cancel"
            onClick={handleCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="file-action-modal-button-confirm"
            onClick={handleConfirm}
            disabled={!value.trim()}
          >
            Confirmar
          </button>
        </div>
      </div>
    </>
  );
}
