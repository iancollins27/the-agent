
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/providers/SettingsProvider";
import { Checkbox } from "@/components/ui/checkbox";
import { Json } from "@/integrations/supabase/types";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Trash } from "lucide-react";

type KnowledgeBaseEntry = {
  id: string;
  title: string | null;
  content: string;
  url: string | null;
  company_id: string;
  source_id: string;
  source_type: string;
  last_updated: string | null;
  metadata: Json | null;
  file_name?: string | null;
  file_type?: string | null;
  selected?: boolean;
};

export const KnowledgeBaseExplorer = () => {
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBaseEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { companySettings } = useSettings();
  const { toast } = useToast();

  useEffect(() => {
    if (companySettings?.id) {
      fetchKnowledgeBaseEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySettings]); // Re-fetch when companySettings changes

  const fetchKnowledgeBaseEntries = async () => {
    try {
      if (!companySettings?.id) {
        throw new Error("No company ID available");
      }
      setIsLoading(true);
      const { data, error } = await supabase
        .from('knowledge_base_embeddings')
        .select('*')
        .eq('company_id', companySettings.id);
      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching knowledge base entries:', error);
      toast({
        title: "Error",
        description: "Failed to load knowledge base entries",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEntrySelection = (id: string) => {
    setEntries(entries.map(entry =>
      entry.id === id ? { ...entry, selected: !entry.selected } : entry
    ));
  };

  // Delete DB entry and corresponding storage file if source_id is a file path
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      // Remove db record first
      const { error: dbError } = await supabase
        .from('knowledge_base_embeddings')
        .delete()
        .eq('id', deleteTarget.id);

      if (dbError) {
        throw dbError;
      }

      // If it's an uploaded file (from KnowledgeBaseUploader), remove from storage
      // The convention is: uploaded files have source_type 'page' or 'notion' and source_id like {company_id}/... (file path pattern)
      if (deleteTarget?.source_id && typeof deleteTarget?.source_id === "string" && deleteTarget?.source_id.includes("/")) {
        const { error: storageError } = await supabase
          .storage
          .from("knowledge_base_documents")
          .remove([deleteTarget.source_id]);
        if (storageError) {
          // Not fatal but notify in console
          console.warn("File deleted from DB but failed to remove from storage:", storageError);
        }
      }

      toast({
        title: "Deleted",
        description: "Knowledge base entry deleted.",
      });

      // Remove from client state
      setEntries(entries => entries.filter(e => e.id !== deleteTarget.id));
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete entry.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Knowledge Base Explorer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <p>Loading knowledge base entries...</p>
            ) : companySettings?.id && entries.length === 0 ? (
              <p>No entries found in the knowledge base. Try syncing with Notion first.</p>
            ) : !companySettings?.id ? (
              <p>Waiting for company settings to load...</p>
            ) : (
              <div className="space-y-4">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={entry.selected}
                      onCheckedChange={() => toggleEntrySelection(entry.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{entry.title || 'Untitled Entry'}</h3>
                      <p className="text-sm text-gray-500 mt-1 break-words">
                        {entry.content.substring(0, 150)}...
                      </p>
                      {entry.url && (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:underline"
                        >
                          View in Notion
                        </a>
                      )}
                    </div>
                    <div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="outline" className="text-red-500 hover:bg-red-50"
                            aria-label="Delete"
                            onClick={() => setDeleteTarget(entry)}
                            disabled={isDeleting}
                          >
                            <Trash />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete <span className="font-bold">"{entry.title || entry.file_name || 'Untitled'}"</span> from your knowledge base.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDelete}
                              disabled={isDeleting}
                            >
                              {isDeleting && deleteTarget?.id === entry.id ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
};
