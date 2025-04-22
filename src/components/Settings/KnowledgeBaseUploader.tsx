
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/providers/SettingsProvider";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const KnowledgeBaseUploader: React.FC = () => {
  const { companySettings } = useSettings();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      setFile(null);
      return;
    }
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!companySettings?.id) {
      toast({
        title: "Company Settings Missing",
        description: "Could not determine your company for uploads.",
        variant: "destructive",
      });
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only PDFs and DOCX files are allowed.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    const filePath = `${companySettings.id}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("knowledge_base_documents")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    // Insert entry into `knowledge_base_embeddings` as "pending"
    // Fix: Use a valid source_type value - 'document' instead of 'file'
    const { error: insertError } = await supabase
      .from("knowledge_base_embeddings")
      .insert([{
        company_id: companySettings.id,
        source_id: filePath,
        source_type: "document", // Changed from 'file' to 'document' to match the constraint
        content: "", // Empty content initially, will be filled by the processing function
        title: file.name,
        url: null,
        file_name: file.name,
        file_type: file.type,
        metadata: { uploaded_by: "user", status: "pending" },
        last_updated: new Date().toISOString(),
      }]);

    setUploading(false);

    if (insertError) {
      toast({
        title: "Failed to store document info",
        description: insertError.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success!",
      description: "File uploaded. It will be processed and added to your knowledge base.",
    });
    setFile(null);
  };

  return (
    <div className="mb-6 space-y-3 bg-slate-50 border rounded-lg p-4">
      <label className="font-medium">Upload PDF or DOCX to Knowledge Base</label>
      <input
        type="file"
        accept=".pdf, .docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileChange}
        className="block"
        disabled={uploading}
      />
      <Button
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? "Uploading..." : "Upload"}
      </Button>
      <div className="text-xs text-muted-foreground">
        Only PDF/DOCX files up to 50MB per file. Results will appear below after processing.
      </div>
    </div>
  );
};
