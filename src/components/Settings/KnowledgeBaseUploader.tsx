
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/providers/SettingsProvider";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const KnowledgeBaseUploader: React.FC = () => {
  const { companySettings } = useSettings();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processAllChunks, setProcessAllChunks] = useState(true);
  const [chunkSize, setChunkSize] = useState(800);

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
      // Using 'file' for source_type instead of 'document' to meet the constraint
      const { data: insertData, error: insertError } = await supabase
        .from("knowledge_base_embeddings")
        .insert({
          company_id: companySettings.id,
          source_id: filePath,
          source_type: "file",  // Changed from 'document' to 'file'
          content: " ",
          title: file.name,
          file_name: file.name,
          file_type: file.type,
          metadata: { 
            uploaded_by: "user", 
            status: "pending",
            processing_status: "pending",
            upload_date: new Date().toISOString(),
            chunk_size: chunkSize
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
          body: { 
            record_id: insertData.id,
            process_all_chunks: processAllChunks,
            chunk_size: chunkSize
          }
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
          description: processAllChunks 
            ? "File uploaded and full processing started. This may take a moment for large documents."
            : "File uploaded and initial processing started. Additional chunks will be processed in the background.",
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
      
      <div className="flex items-center space-x-2">
        <Switch
          id="process-all-chunks"
          checked={processAllChunks}
          onCheckedChange={setProcessAllChunks}
        />
        <Label htmlFor="process-all-chunks" className="text-sm">
          Process all document chunks immediately
        </Label>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="chunk-size" className="text-sm">
          Chunk Size: {chunkSize} tokens (approx. {Math.round(chunkSize * 4)} characters)
        </Label>
        <Slider 
          id="chunk-size"
          defaultValue={[chunkSize]} 
          min={400} 
          max={2000} 
          step={100}
          onValueChange={(values) => setChunkSize(values[0])}
          className="w-full max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          Smaller chunks are more precise but may lose context. Larger chunks retain more context but may be less specific.
        </p>
      </div>
      
      <p className="text-xs text-muted-foreground">
        {processAllChunks 
          ? "Large documents will be fully processed at once. This may take longer but ensures complete vectorization."
          : "Large documents will be processed in chunks. The first chunk will be processed immediately, while others will be processed in the background."}
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
