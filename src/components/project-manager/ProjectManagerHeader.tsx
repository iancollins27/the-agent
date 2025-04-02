
import React from 'react';

interface ProjectManagerHeaderProps {
  title: string;
}

const ProjectManagerHeader: React.FC<ProjectManagerHeaderProps> = ({ 
  title 
}) => {
  return (
    <h2 className="text-2xl font-bold">{title}</h2>
  );
};

export default ProjectManagerHeader;
