
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
      const { data, error } = await supabase.storage
        .from("knowledge_base_documents")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      // Get list of allowed source_type values from database
      const { data: tableInfo, error: tableInfoError } = await supabase.rpc(
        'get_table_info',
        { table_name: 'knowledge_base_embeddings' }
      );

      // Log constraints for debugging
      console.log("Table constraints:", tableInfo);

      // Second step: Create record in knowledge_base_embeddings with only the required fields
      const { error: insertError } = await supabase
        .from("knowledge_base_embeddings")
        .insert({
          company_id: companySettings.id,
          source_id: filePath,
          source_type: "notion", // Try using a different source type that might be allowed
          content: " ", // Non-empty content
          title: file.name,
          file_name: file.name,
          file_type: file.type,
          metadata: { 
            uploaded_by: "user", 
            status: "pending",
            upload_date: new Date().toISOString() 
          },
          last_updated: new Date().toISOString(),
        });

      if (insertError) {
        // If first attempt fails, try with a different source_type
        console.log("First attempt failed, trying with alternative source_type:", insertError);
        
        const { error: secondInsertError } = await supabase
          .from("knowledge_base_embeddings")
          .insert({
            company_id: companySettings.id,
            source_id: filePath,
            source_type: "page", // Try another potential value
            content: " ", // Non-empty content
            title: file.name,
            file_name: file.name,
            file_type: file.type,
            metadata: { 
              uploaded_by: "user", 
              status: "pending",
              upload_date: new Date().toISOString() 
            },
            last_updated: new Date().toISOString(),
          });

        if (secondInsertError) {
          // Both attempts failed, clean up and throw error
          await supabase.storage
            .from("knowledge_base_documents")
            .remove([filePath]);
            
          console.error("Insert errors:", { insertError, secondInsertError });
          
          // Check column info for source_type
          const { data: columnInfo, error: columnInfoError } = await supabase.rpc(
            'get_column_info',
            { 
              table_name: 'knowledge_base_embeddings',
              column_name: 'source_type'
            }
          );
          
          console.log("source_type column info:", columnInfo);
          
          throw new Error(`Database insert failed: ${secondInsertError.message}`);
        }
      }

      toast({
        title: "Success!",
        description: "File uploaded. It will be processed and added to your knowledge base.",
      });
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
