import { SystemPromptSettings } from '@/components/admin/SystemPromptSettings';

export default function AdminSettingsPage() {
    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6">Admin Settings</h1>
            <div className="space-y-8">
                <SystemPromptSettings />
                {/* Add other admin settings components here */}
            </div>
        </div>
    );
} 