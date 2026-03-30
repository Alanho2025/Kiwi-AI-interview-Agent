import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { Checkbox } from '../common/Checkbox.jsx';
import { FileText, UploadCloud, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../utils/formatters.js';

export function CVManagementCard({ onUpload, recentCVs, onSelectRecent }) {
  const [selectedRecent, setSelectedRecent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const processUpload = async (file) => {
    setIsUploading(true);
    setUploadSuccess(false);
    setSelectedRecent(null); // Clear selected recent when uploading new
    const success = await onUpload(file);
    setIsUploading(false);
    if (success) {
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processUpload(e.target.files[0]);
      e.target.value = null; // Reset input
    }
  };

  const requestPermissionAndOpenPicker = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const deviceName = isMobile ? "device's" : "computer's";
    const confirmed = window.confirm(`Allow Kiwi Voice Coach to access your ${deviceName} file system?`);
    if (confirmed) {
      fileInputRef.current?.click();
    }
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
        alert('Only PDF and DOCX files are allowed');
        return;
      }
      processUpload(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>CV Management</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Provide a resume to let the AI match your background with the role.</p>
        </div>
        <div className="flex items-center text-xs text-gray-400 gap-1">
          <Lock className="w-3 h-3" />
          <span>Encrypted · Google connected</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex justify-between items-end mb-3">
            <h4 className="text-sm font-medium text-gray-900">Upload your CV</h4>
            {isUploading && <span className="text-xs text-[#2eb886] flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Uploading...</span>}
            {uploadSuccess && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Upload successful!</span>}
          </div>
          <div 
            className={cn(
              "border-2 border-dashed rounded-xl p-6 flex items-center justify-between cursor-pointer transition-colors",
              isDragging ? "border-[#2eb886] bg-[#e6f7f0]" : "border-gray-200 hover:bg-gray-50"
            )}
            onClick={requestPermissionAndOpenPicker}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-4 pointer-events-none">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Drop files here or click to upload</p>
                <p className="text-xs text-gray-500 mt-1">PDF, DOCX · Max 5MB</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              type="button" 
              onClick={requestPermissionAndOpenPicker}
            >
              Choose File
            </Button>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept=".pdf,.docx" 
              onChange={handleFileChange} 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Checkbox label="Use my default CV from Profile" />
          <button className="text-sm text-[#2eb886] hover:underline">Manage profile CV</button>
        </div>

        {recentCVs && recentCVs.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Recent CVs</h4>
            <div className="space-y-3">
              {recentCVs.map((cv) => (
                <div key={cv.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{cv.name}</p>
                      <p className="text-xs text-gray-500">Updated: {cv.updated} · {cv.size}</p>
                    </div>
                  </div>
                  <Button 
                    variant={selectedRecent === cv.id ? 'primary' : 'ghost'} 
                    size="sm" 
                    onClick={() => {
                      setSelectedRecent(cv.id);
                      onSelectRecent(cv.id);
                    }}
                  >
                    Use
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
