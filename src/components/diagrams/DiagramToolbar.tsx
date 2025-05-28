
import React from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Download, Search } from 'lucide-react';

interface DiagramToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onExport: () => void;
  onSearch: (term: string) => void;
}

const DiagramToolbar: React.FC<DiagramToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  onExport,
  onSearch
}) => {
  return (
    <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg mb-4">
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onZoomIn}
          className="flex items-center gap-1"
        >
          <ZoomIn className="w-4 h-4" />
          Zoom In
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onZoomOut}
          className="flex items-center gap-1"
        >
          <ZoomOut className="w-4 h-4" />
          Zoom Out
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onReset}
          className="flex items-center gap-1"
        >
          <RotateCcw className="w-4 h-4" />
          Reset View
        </Button>
      </div>
      
      <div className="h-6 w-px bg-gray-300 mx-2" />
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onExport}
        className="flex items-center gap-1"
      >
        <Download className="w-4 h-4" />
        Export PNG
      </Button>
      
      <div className="h-6 w-px bg-gray-300 mx-2" />
      
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search components..."
          className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    </div>
  );
};

export default DiagramToolbar;
