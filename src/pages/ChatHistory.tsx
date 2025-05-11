
import { useState } from "react";
import { Search, Filter, Download, User, Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

// Mock data for chat history
const mockChatHistory = [
  {
    id: "1",
    visitor: {
      id: "vis_123",
      ip: "192.168.1.1",
      userAgent: "Chrome 90",
    },
    startTime: new Date("2023-04-15T08:23:12"),
    endTime: new Date("2023-04-15T08:35:42"),
    messages: [
      { role: "bot", content: "Hello! How can I help you today?" },
      { role: "user", content: "I need help with my order #12345" },
      { role: "bot", content: "I'd be happy to help with your order. Could you provide more details about the issue you're experiencing?" },
      { role: "user", content: "I ordered a product but it hasn't arrived yet" },
      { role: "bot", content: "I understand your concern. Let me check the status of your order. According to our records, your order #12345 was shipped on April 10th and is expected to arrive by April 17th. Would you like me to send you the tracking information?" },
      { role: "user", content: "Yes please" },
      { role: "bot", content: "Here's your tracking link: https://tracking.example.com/12345. Is there anything else I can help you with?" },
    ],
    resolved: true,
    escalated: false,
    duration: "12m 30s",
  },
  {
    id: "2",
    visitor: {
      id: "vis_456",
      ip: "192.168.1.2",
      userAgent: "Firefox 88",
    },
    startTime: new Date("2023-04-14T14:05:22"),
    endTime: new Date("2023-04-14T14:12:15"),
    messages: [
      { role: "bot", content: "Hello! How can I help you today?" },
      { role: "user", content: "How do I reset my password?" },
      { role: "bot", content: "You can reset your password by clicking on the 'Forgot Password' link on the login page. Would you like me to send you the direct link?" },
      { role: "user", content: "Yes" },
      { role: "bot", content: "Here's the link: https://example.com/reset-password. After clicking it, you'll receive an email with instructions to reset your password." },
    ],
    resolved: true,
    escalated: false,
    duration: "6m 53s",
  },
  {
    id: "3",
    visitor: {
      id: "vis_789",
      ip: "192.168.1.3",
      userAgent: "Safari 14",
    },
    startTime: new Date("2023-04-13T09:12:33"),
    endTime: new Date("2023-04-13T09:30:01"),
    messages: [
      { role: "bot", content: "Hello! How can I help you today?" },
      { role: "user", content: "I want to cancel my subscription" },
      { role: "bot", content: "I can help you with cancelling your subscription. Could you please confirm which subscription you'd like to cancel?" },
      { role: "user", content: "The premium plan" },
      { role: "bot", content: "Thank you for confirming. To cancel your premium subscription, I'll need to transfer you to our customer support team. Would that be okay?" },
      { role: "user", content: "Yes, please connect me with someone" },
      { role: "bot", content: "I'm connecting you with a support agent. Please hold." },
      { role: "system", content: "Chat escalated to human agent" },
      { role: "agent", content: "Hello, I'm Sarah from customer support. I understand you want to cancel your premium subscription. I'd be happy to assist you with that." },
    ],
    resolved: true,
    escalated: true,
    duration: "17m 28s",
  },
];

const ChatHistory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<typeof mockChatHistory[0] | null>(null);
  const [filter, setFilter] = useState("all");

  // Filter chats based on search query and filter value
  const filteredChats = mockChatHistory.filter((chat) => {
    const matchesSearch = chat.messages.some((msg) =>
      msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (filter === "all") return matchesSearch;
    if (filter === "escalated") return matchesSearch && chat.escalated;
    if (filter === "resolved") return matchesSearch && chat.resolved;
    
    return matchesSearch;
  });

  const handleExportCSV = () => {
    // In a real app, this would generate and download a CSV file
    alert("Exporting chats to CSV...");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Chat History</h1>
          <p className="text-gray-600">Review past conversations with your visitors</p>
        </div>
        
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/3">
          <Card>
            <CardHeader className="px-4 py-3">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
            </CardHeader>
            <CardContent className="px-2 py-0">
              <div className="flex items-center px-2 pb-2">
                <Filter className="w-4 h-4 text-gray-500 mr-2" />
                <Select defaultValue="all" onValueChange={setFilter}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Conversations</SelectItem>
                    <SelectItem value="escalated">Escalated Only</SelectItem>
                    <SelectItem value="resolved">Resolved Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="divide-y">
                {filteredChats.length === 0 ? (
                  <div className="py-6 text-center text-gray-500">
                    No conversations found
                  </div>
                ) : (
                  filteredChats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`p-3 cursor-pointer hover:bg-gray-50 ${
                        selectedConversation?.id === chat.id
                          ? "bg-gray-50 border-l-2 border-primary"
                          : ""
                      }`}
                      onClick={() => setSelectedConversation(chat)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium">{`Visitor ${chat.visitor.id}`}</div>
                        <div className="text-xs text-gray-500">
                          {format(chat.startTime, "MMM d, yyyy")}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 truncate mb-1">
                        {chat.messages[chat.messages.length - 1].content}
                      </div>
                      <div className="flex items-center text-xs">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                            chat.escalated
                              ? "bg-orange-100 text-orange-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {chat.escalated ? "Escalated" : "AI Resolved"}
                        </span>
                        <span className="text-gray-500 ml-2">{chat.duration}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full md:w-2/3">
          {selectedConversation ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <CardTitle>Conversation Details</CardTitle>
                  <div className="text-sm text-gray-500">
                    {format(selectedConversation.startTime, "MMMM d, yyyy")}
                  </div>
                </div>
                <CardDescription>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      <span className="text-sm">{`Visitor ${selectedConversation.visitor.id}`}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span className="text-sm">
                        {format(selectedConversation.startTime, "h:mm a")} - {format(selectedConversation.endTime, "h:mm a")}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      <span className="text-sm">{selectedConversation.duration}</span>
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedConversation.messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`p-3 rounded-lg max-w-[70%] ${
                          message.role === "user"
                            ? "bg-chat-user-bubble text-gray-800"
                            : message.role === "agent"
                            ? "bg-orange-100 text-gray-800"
                            : message.role === "system"
                            ? "bg-gray-200 text-gray-800 italic"
                            : "bg-chat-bot-bubble text-white"
                        }`}
                      >
                        {message.role === "agent" && (
                          <div className="text-xs font-semibold mb-1 text-orange-800">
                            Human Agent
                          </div>
                        )}
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-between">
                <div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      selectedConversation.escalated
                        ? "bg-orange-100 text-orange-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {selectedConversation.escalated ? "Escalated to Human" : "Resolved by AI"}
                  </span>
                </div>
                
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export Conversation
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                <p className="text-gray-500 mb-2">Select a conversation to view details</p>
                <p className="text-sm text-gray-400">
                  Click on any conversation from the list on the left
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;
