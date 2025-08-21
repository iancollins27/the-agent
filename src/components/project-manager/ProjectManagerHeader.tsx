
import React from 'react';

interface ProjectManagerHeaderProps {
  title: string;
}

const ProjectManagerHeader: React.FC<ProjectManagerHeaderProps> = ({ 
  title 
}) => {
  return (
    <h2 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h2>
  );
};

export default ProjectManagerHeader;
