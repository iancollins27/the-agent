
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
import { Loader2, Plus } from 'lucide-react';

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
      if (data && data.length > 0) {
        setSelectedTrack(data[0]);
      }
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tracks">Tracks</TabsTrigger>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
            </TabsList>
            
            <TabsContent value="tracks" className="space-y-4 mt-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex gap-4">
                    <div className="w-1/3 space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium">Track List</h3>
                        <Button size="sm" variant="outline" onClick={handleCreateNewTrack}>
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                      <div className="border rounded-md overflow-hidden">
                        <ul className="divide-y">
                          {projectTracks.map(track => (
                            <li 
                              key={track.id} 
                              className={`px-4 py-2 hover:bg-gray-50 cursor-pointer ${
                                selectedTrack?.id === track.id ? 'bg-gray-100 dark:bg-gray-800' : ''
                              }`}
                              onClick={() => setSelectedTrack(track)}
                            >
                              {track.name}
                            </li>
                          ))}
                          {projectTracks.length === 0 && (
                            <li className="px-4 py-2 text-gray-500">
                              No tracks found. Create your first track.
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                    
                    <div className="w-2/3 border rounded-md p-4">
                      {selectedTrack ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="trackName">Track Name</Label>
                            <Input 
                              id="trackName"
                              value={selectedTrack.name} 
                              onChange={(e) => handleTrackChange('name', e.target.value)} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="trackRoles">Track Roles</Label>
                            <Textarea 
                              id="trackRoles"
                              value={selectedTrack.Roles || ''} 
                              onChange={(e) => handleTrackChange('Roles', e.target.value)}
                              placeholder="Define project roles for this track..."
                              rows={4}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="trackPrompt">Base Prompt</Label>
                            <Textarea 
                              id="trackPrompt"
                              value={selectedTrack['track base prompt'] || ''} 
                              onChange={(e) => handleTrackChange('track base prompt', e.target.value)}
                              placeholder="Define the base prompt for this track..."
                              rows={6}
                            />
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
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No track selected or no tracks available.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
            
            <TabsContent value="milestones" className="mt-4">
              {selectedTrack ? (
                <ProjectTrackMilestones trackId={selectedTrack.id} trackName={selectedTrack.name} />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {projectTracks.length === 0 
                    ? "No tracks available. Please create a track first." 
                    : "Please select a track to manage its milestones."}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectTrackSettings;
