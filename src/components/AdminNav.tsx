import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  FileText, 
  Database, 
  Bot, 
  Users, 
  BarChart 
} from 'lucide-react';

const AdminNav: React.FC = () => {
  const pathname = usePathname();
  
  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />
    },
    {
      name: 'Documents',
      href: '/documents',
      icon: <FileText className="h-5 w-5" />
    },
    {
      name: 'Knowledge Base',
      href: '/knowledge-base',
      icon: <Database className="h-5 w-5" />
    },
    {
      name: 'Agent Testing',
      href: '/agent-testing',
      icon: <Bot className="h-5 w-5" />
    },
    {
      name: 'Chat History',
      href: '/chat-history',
      icon: <MessageSquare className="h-5 w-5" />
    },
    {
      name: 'Users',
      href: '/users',
      icon: <Users className="h-5 w-5" />
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: <BarChart className="h-5 w-5" />
    },
    {
      name: 'Settings',
      href: '/chat-settings',
      icon: <Settings className="h-5 w-5" />
    }
  ];
  
  return (
    <div className="flex flex-col space-y-1 w-full">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors",
            pathname === item.href ? "bg-gray-100 font-medium" : "text-gray-700"
          )}
        >
          <div className={cn(
            "mr-3",
            pathname === item.href ? "text-primary" : "text-gray-500"
          )}>
            {item.icon}
          </div>
          {item.name}
        </Link>
      ))}
    </div>
  );
};

export default AdminNav;
