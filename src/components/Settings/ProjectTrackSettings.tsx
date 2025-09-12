import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ProjectTrackMilestones from './ProjectTrackMilestones';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Plus, ChevronRight } from 'lucide-react';

interface ProjectTrack {
  id: string;
  name: string;
  Roles: string | null;
  'track base prompt': string | null;
  company_id: string;
}

const ProjectTrackSettings = () => {
  const { companySettings } = useSettings();
  const [projectTracks, setProjectTracks] = useState<ProjectTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<ProjectTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("tracks");
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);

  useEffect(() => {
    if (companySettings?.id) {
      loadProjectTracks();
    }
  }, [companySettings]);

  const loadProjectTracks = async () => {
    if (!companySettings?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_tracks')
        .select('*')
        .eq('company_id', companySettings.id)
        .order('name');

      if (error) throw error;
      
      setProjectTracks(data || []);
    } catch (error) {
      console.error('Error loading project tracks:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load project tracks.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewTrack = async () => {
    if (!companySettings?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('project_tracks')
        .insert({
          name: 'New Track',
          company_id: companySettings.id,
          Roles: '',
          'track base prompt': ''
        })
        .select()
        .single();

      if (error) throw error;
      
      setProjectTracks([...projectTracks, data]);
      setSelectedTrack(data);
      toast({
        title: 'Success',
        description: 'New track created.'
      });
    } catch (error) {
      console.error('Error creating new track:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create new track.'
      });
    }
  };

  const handleTrackChange = (field: keyof ProjectTrack, value: string) => {
    if (!selectedTrack) return;
    
    setSelectedTrack({
      ...selectedTrack,
      [field]: value
    });
  };

  const handleSaveTrack = async () => {
    if (!selectedTrack) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('project_tracks')
        .update({
          name: selectedTrack.name,
          Roles: selectedTrack.Roles,
          'track base prompt': selectedTrack['track base prompt'],
        })
        .eq('id', selectedTrack.id);

      if (error) throw error;
      
      // Update the project tracks list with the updated track
      setProjectTracks(projectTracks.map(track => 
        track.id === selectedTrack.id ? selectedTrack : track
      ));
      
      toast({
        title: 'Success',
        description: 'Track updated successfully.'
      });
    } catch (error) {
      console.error('Error saving track:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save track.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTrack = async () => {
    if (!selectedTrack || !confirm('Are you sure you want to delete this track?')) return;
    
    try {
      const { error } = await supabase
        .from('project_tracks')
        .delete()
        .eq('id', selectedTrack.id);

      if (error) throw error;
      
      const updatedTracks = projectTracks.filter(track => track.id !== selectedTrack.id);
      setProjectTracks(updatedTracks);
      setSelectedTrack(updatedTracks.length > 0 ? updatedTracks[0] : null);
      
      toast({
        title: 'Success',
        description: 'Track deleted successfully.'
      });
    } catch (error) {
      console.error('Error deleting track:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete track. It may be in use by existing projects.'
      });
    }
  };

  const handleTrackSelect = (track: ProjectTrack) => {
    setSelectedTrack(track);
    setExpandedTrackId(track.id);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Tracks</CardTitle>
          <CardDescription>
            Configure project tracks, milestones, and roles for your company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Track Management</h3>
                <Button size="sm" variant="outline" onClick={handleCreateNewTrack}>
                  <Plus className="h-4 w-4 mr-1" /> Add Track
                </Button>
              </div>
              
              {projectTracks.length === 0 ? (
                <div className="text-center py-8 border rounded-md">
                  <p className="text-gray-500">No tracks found. Create your first track.</p>
                </div>
              ) : (
                <Accordion 
                  type="single" 
                  collapsible 
                  value={expandedTrackId || ''} 
                  onValueChange={(value) => setExpandedTrackId(value)}
                  className="w-full"
                >
                  {projectTracks.map(track => (
                    <AccordionItem key={track.id} value={track.id} className="border rounded-md mb-4 overflow-hidden">
                      <AccordionTrigger 
                        className="px-4 py-3 hover:bg-gray-50 font-medium" 
                        onClick={() => handleTrackSelect(track)}
                      >
                        {track.name}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-6 p-4">
                          <div className="space-y-6">
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor={`trackName-${track.id}`}>Track Name</Label>
                                <Input 
                                  id={`trackName-${track.id}`}
                                  value={selectedTrack?.id === track.id ? selectedTrack.name : track.name} 
                                  onChange={(e) => selectedTrack?.id === track.id && handleTrackChange('name', e.target.value)} 
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`trackRoles-${track.id}`}>Track Roles</Label>
                                <Textarea 
                                  id={`trackRoles-${track.id}`}
                                  value={selectedTrack?.id === track.id ? selectedTrack.Roles || '' : track.Roles || ''} 
                                  onChange={(e) => selectedTrack?.id === track.id && handleTrackChange('Roles', e.target.value)}
                                  placeholder="Define project roles for this track..."
                                  rows={4}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`trackPrompt-${track.id}`}>Base Prompt</Label>
                                <Textarea 
                                  id={`trackPrompt-${track.id}`}
                                  value={selectedTrack?.id === track.id ? selectedTrack['track base prompt'] || '' : track['track base prompt'] || ''} 
                                  onChange={(e) => selectedTrack?.id === track.id && handleTrackChange('track base prompt', e.target.value)}
                                  placeholder="Define the base prompt for this track..."
                                  rows={6}
                                />
                              </div>
                            </div>
                            
                            <div className="flex justify-between pt-2">
                              <Button 
                                variant="destructive" 
                                onClick={handleDeleteTrack}
                                disabled={isSaving || projectTracks.length <= 1}
                              >
                                Delete Track
                              </Button>
                              <Button 
                                onClick={handleSaveTrack}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                  </>
                                ) : 'Save Changes'}
                              </Button>
                            </div>
                          </div>
                          
                          <div className="mt-8 pt-6 border-t">
                            <ProjectTrackMilestones trackId={track.id} trackName={track.name} />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectTrackSettings;
