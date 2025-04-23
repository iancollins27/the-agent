
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

    try {
      // First step: Upload the file to Supabase Storage
      const filePath = `${companySettings.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("knowledge_base_documents")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Second step: Create record in knowledge_base_embeddings
      const { data: insertData, error: insertError } = await supabase
        .from("knowledge_base_embeddings")
        .insert({
          company_id: companySettings.id,
          source_id: filePath,
          source_type: "document",  // Using valid value for the constraint
          content: " ",
          title: file.name,
          file_name: file.name,
          file_type: file.type,
          metadata: { 
            uploaded_by: "user", 
            status: "pending",
            processing_status: "pending",
            upload_date: new Date().toISOString() 
          },
          last_updated: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        // Clean up the uploaded file if database insert fails
        await supabase.storage
          .from("knowledge_base_documents")
          .remove([filePath]);
        throw insertError;
      }

      // Third step: Trigger the embedding process
      const { error: processError } = await supabase.functions.invoke(
        'process-document-embedding',
        {
          body: { record_id: insertData.id }
        }
      );

      if (processError) {
        console.warn('Warning: Document uploaded but processing failed:', processError);
        toast({
          title: "File uploaded",
          description: "File uploaded but processing delayed. Check back later.",
          variant: "default",
        });
      } else {
        toast({
          title: "Success!",
          description: "File uploaded and processing started.",
          variant: "default",
        });
      }

      setFile(null);
    } catch (error) {
      console.error("Upload process failed:", error);
      toast({
        title: "Upload failed",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-6 space-y-3 bg-slate-50 border rounded-lg p-4">
      <h3 className="font-medium text-lg">Upload Documents to Knowledge Base</h3>
      <p className="text-sm text-muted-foreground">
        Add PDF or DOCX documents to your knowledge base for AI to reference when answering questions.
      </p>
      <input
        type="file"
        accept=".pdf, .docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileChange}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
        disabled={uploading}
      />
      <Button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full sm:w-auto"
      >
        {uploading ? "Uploading..." : "Upload Document"}
      </Button>
      <div className="text-xs text-muted-foreground">
        Only PDF/DOCX files up to 50MB per file. Results will appear below after processing.
      </div>
    </div>
  );
};
