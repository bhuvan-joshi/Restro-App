import React from 'react';
import { SystemPromptSettings } from '@/components/admin/SystemPromptSettings';

const AdminSettings: React.FC = () => {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Settings</h1>
      <div className="space-y-8">
        <SystemPromptSettings />
        {/* Add other admin settings components here */}
              </div>
    </div>
  );
};

export default AdminSettings;
