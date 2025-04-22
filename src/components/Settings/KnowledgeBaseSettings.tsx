
import React from 'react';
import { KnowledgeBaseExplorer } from "./KnowledgeBaseExplorer";
import { KnowledgeBaseChat } from "./KnowledgeBaseChat";
import { KnowledgeBaseUploader } from "./KnowledgeBaseUploader";
import { useSettings } from "@/providers/SettingsProvider";
import NotionIntegrationForm from "./NotionIntegrationForm";

const KnowledgeBaseSettings: React.FC = () => {
  const { companySettings, updateCompanySettings } = useSettings();

  return (
    <div className="space-y-6">
      <KnowledgeBaseUploader />

      <NotionIntegrationForm companySettings={companySettings} updateCompanySettings={updateCompanySettings} />

      <KnowledgeBaseExplorer />
      <KnowledgeBaseChat />
    </div>
  );
};

export default KnowledgeBaseSettings;
