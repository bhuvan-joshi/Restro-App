import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api.config';

export function SystemPromptSettings() {
    const [systemPrompt, setSystemPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchSystemPrompt();
    }, []);

    const fetchSystemPrompt = async () => {
        try {
            console.log('Fetching system prompt...');
            const token = localStorage.getItem('auth_token');
            
            if (!token) {
                console.error('No auth token found');
                toast.error('Authentication required');
                return;
            }
            
            const response = await fetch(`${API_BASE_URL}/admin/settings/system-prompt`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Received system prompt:', data);
                setSystemPrompt(data.systemPrompt || '');
            } else {
                const errorText = await response.text();
                console.error('Failed to load system prompt:', response.status, errorText);
                toast.error(`Failed to load system prompt: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Exception loading system prompt:', error);
            toast.error(`Failed to load system prompt: ${error.message}`);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            console.log('Saving system prompt...');
            const token = localStorage.getItem('auth_token');
            
            if (!token) {
                console.error('No auth token found');
                toast.error('Authentication required');
                setIsLoading(false);
                return;
            }
            
            const response = await fetch(`${API_BASE_URL}/admin/settings/system-prompt`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ systemPrompt }),
            });
            console.log('Save response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Save response:', data);
                toast.success('System prompt updated successfully');
            } else {
                const errorText = await response.text();
                console.error('Failed to update system prompt:', response.status, errorText);
                toast.error(`Failed to update: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Exception saving system prompt:', error);
            toast.error(`Failed to update: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>System Prompt Settings</CardTitle>
                <CardDescription>
                    Configure how the AI processes and responds to queries. This prompt provides instructions for handling different document types and response formats.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter system prompt..."
                    className="min-h-[300px] font-mono text-sm"
                />
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button 
                    onClick={handleSave}
                    disabled={isLoading}
                >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
            </CardFooter>
        </Card>
    );
} 