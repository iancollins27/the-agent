
import React from 'react';

interface PromptSectionProps {
  title: string;
  content: string;
  isError?: boolean;
}

const PromptSection: React.FC<PromptSectionProps> = ({ title, content, isError = false }) => {
  return (
    <div className="space-y-2">
      <h3 className={`text-lg font-medium ${isError ? 'text-red-500' : ''}`}>{title}</h3>
      <pre className={`${isError ? 'bg-red-50 text-red-500' : 'bg-slate-100'} p-4 rounded overflow-auto max-h-60 text-sm whitespace-pre-wrap break-words`}>
        {content}
      </pre>
    </div>
  );
};

export default PromptSection;
