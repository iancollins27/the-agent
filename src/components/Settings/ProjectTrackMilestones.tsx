
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Check, X } from 'lucide-react';

interface Milestone {
  id: string;
  track_id: string;
  step_title: string;
  description: string | null;
  prompt_instructions: string | null;
  step_order: number | null;
}

interface ProjectTrackMilestonesProps {
  trackId: string;
  trackName: string;
}

const ProjectTrackMilestones: React.FC<ProjectTrackMilestonesProps> = ({ trackId, trackName }) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (trackId) {
      loadMilestones();
    }
  }, [trackId]);

  const loadMilestones = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_track_milestones')
        .select('*')
        .eq('track_id', trackId)
        .order('step_order', { ascending: true });

      if (error) throw error;
      
      setMilestones(data || []);
    } catch (error) {
      console.error('Error loading milestones:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load milestones for this track.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMilestone = () => {
    const newMilestone: Milestone = {
      id: 'new',
      track_id: trackId,
      step_title: '',
      description: '',
      prompt_instructions: '',
      step_order: milestones.length + 1
    };
    setEditingMilestone(newMilestone);
    setIsEditing(true);
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone({ ...milestone });
    setIsEditing(true);
  };

  const handleChange = (field: keyof Milestone, value: string | number) => {
    if (!editingMilestone) return;
    
    setEditingMilestone({
      ...editingMilestone,
      [field]: value
    });
  };

  const handleSaveMilestone = async () => {
    if (!editingMilestone || !editingMilestone.step_title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Milestone title is required.'
      });
      return;
    }

    try {
      let result;
      
      if (editingMilestone.id === 'new') {
        // Create new milestone
        const { data, error } = await supabase
          .from('project_track_milestones')
          .insert({
            track_id: trackId,
            step_title: editingMilestone.step_title,
            description: editingMilestone.description,
            prompt_instructions: editingMilestone.prompt_instructions,
            step_order: editingMilestone.step_order,
            track_id_name: trackName // Store the track name for reference
          })
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      } else {
        // Update existing milestone
        const { data, error } = await supabase
          .from('project_track_milestones')
          .update({
            step_title: editingMilestone.step_title,
            description: editingMilestone.description,
            prompt_instructions: editingMilestone.prompt_instructions,
            step_order: editingMilestone.step_order,
            track_id_name: trackName // Update the track name in case it changed
          })
          .eq('id', editingMilestone.id)
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      }
      
      // Refresh the milestones list
      await loadMilestones();
      
      setEditingMilestone(null);
      setIsEditing(false);
      
      toast({
        title: 'Success',
        description: 'Milestone saved successfully.'
      });
    } catch (error) {
      console.error('Error saving milestone:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save milestone.'
      });
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return;
    
    try {
      const { error } = await supabase
        .from('project_track_milestones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Refresh the list
      await loadMilestones();
      
      toast({
        title: 'Success',
        description: 'Milestone deleted successfully.'
      });
    } catch (error) {
      console.error('Error deleting milestone:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete milestone.'
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingMilestone(null);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Milestones for {trackName}</h3>
        {!isEditing && (
          <Button onClick={handleCreateMilestone} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Milestone
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="border rounded-md p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="milestoneTitle">Milestone Title</Label>
            <Input 
              id="milestoneTitle"
              value={editingMilestone?.step_title || ''} 
              onChange={(e) => handleChange('step_title', e.target.value)} 
              placeholder="Enter milestone title"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="milestoneOrder">Order</Label>
            <Input 
              id="milestoneOrder"
              type="number" 
              value={editingMilestone?.step_order || ''} 
              onChange={(e) => handleChange('step_order', parseInt(e.target.value) || 0)} 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="milestoneDescription">Description</Label>
            <Textarea 
              id="milestoneDescription"
              value={editingMilestone?.description || ''} 
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter milestone description"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="milestoneInstructions">Prompt Instructions</Label>
            <Textarea 
              id="milestoneInstructions"
              value={editingMilestone?.prompt_instructions || ''} 
              onChange={(e) => handleChange('prompt_instructions', e.target.value)}
              placeholder="Enter AI prompt instructions for this milestone"
              rows={6}
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button onClick={handleSaveMilestone}>
              <Check className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          {milestones.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {milestones.map(milestone => (
                    <TableRow key={milestone.id}>
                      <TableCell>{milestone.step_order}</TableCell>
                      <TableCell className="font-medium">{milestone.step_title}</TableCell>
                      <TableCell className="truncate max-w-xs">
                        {milestone.description || 'No description'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditMilestone(milestone)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteMilestone(milestone.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center p-8 border rounded-md">
              <p className="text-gray-500">No milestones found for this track. Click "Add Milestone" to create one.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectTrackMilestones;
