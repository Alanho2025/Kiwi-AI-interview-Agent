import { useState } from 'react';

export function useCvUpload({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [localValidationMessage, setLocalValidationMessage] = useState('');

  const processUpload = async (file) => {
    setIsUploading(true);
    setUploadSuccess(false);
    setLocalValidationMessage('');
    const success = await onUpload(file);
    setIsUploading(false);
    if (success) {
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
    return success;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext !== 'pdf' && ext !== 'docx') {
        setLocalValidationMessage('Only PDF and DOCX files are supported right now.');
        return;
      }
      processUpload(file);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processUpload(e.target.files[0]);
      e.target.value = null; // Reset input
    }
  };

  return {
    isDragging,
    isUploading,
    uploadSuccess,
    localValidationMessage,
    setLocalValidationMessage,
    processUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
  };
}
