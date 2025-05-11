import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import EmbedCodeGenerator from "@/components/EmbedCodeGenerator";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Activity, BarChart3, MessageSquare } from "lucide-react";
import { getUserSessions, getUserWidgets, getCurrentUser, getSystemStats, getAllUsers } from "@/services/api";

// Fallback data for when API calls fail or while loading
const fallbackChatData = [
  { date: "Apr 1", chats: 0 },
  { date: "Apr 2", chats: 0 },
  { date: "Apr 3", chats: 0 },
  { date: "Apr 4", chats: 0 },
  { date: "Apr 5", chats: 0 },
  { date: "Apr 6", chats: 0 },
  { date: "Apr 7", chats: 0 },
];

const fallbackUserStatistics = {
  totalChats: 0,
  aiResolutions: 0,
  humanEscalations: 0,
  averageResponseTime: "0s",
  documentCount: 0,
};

// New admin-specific fallback data for superadmin dashboard
const fallbackSignupData = [
  { date: "Apr 1", signups: 0 },
  { date: "Apr 2", signups: 0 },
  { date: "Apr 3", signups: 0 },
  { date: "Apr 4", signups: 0 },
  { date: "Apr 5", signups: 0 },
  { date: "Apr 6", signups: 0 },
  { date: "Apr 7", signups: 0 },
];

const fallbackUserPlanData = [
  { name: "Free", value: 0 },
  { name: "Basic", value: 0 },
  { name: "Premium", value: 0 },
];

const fallbackRecentUsers = [];

const fallbackAdminStats = {
  totalUsers: 0,
  newUsersToday: 0,
  activeUsers: 0,
  premiumUsers: 0,
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

const Dashboard = () => {
  const [period, setPeriod] = useState<"7d" | "14d" | "30d" | "90d">("14d");
  const [chartData, setChartData] = useState(fallbackChatData);
  const [signupData, setSignupData] = useState(fallbackSignupData);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statistics, setStatistics] = useState(fallbackUserStatistics);
  const [adminStats, setAdminStats] = useState(fallbackAdminStats);
  const [userPlanData, setUserPlanData] = useState(fallbackUserPlanData);
  const [recentUsers, setRecentUsers] = useState(fallbackRecentUsers);
  
  useEffect(() => {
    // Check if the user is a superadmin
    const fetchUserRole = async () => {
      try {
        const userResponse = await getCurrentUser();
        const userRole = userResponse.data.role;
        setIsSuperAdmin(userRole === "superadmin");
      } catch (error) {
        console.error("Failed to fetch user data", error);
        // Fallback to localStorage
        const userRole = localStorage.getItem("user_role");
        const isSuperAdminFlag = localStorage.getItem("is_superadmin");
        setIsSuperAdmin(userRole === "superadmin" || isSuperAdminFlag === "true");
      }
    };
    
    fetchUserRole();
  }, []);
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch chat sessions
        const sessionsResponse = await getUserSessions();
        const sessions = sessionsResponse.data;
        
        // Process sessions to generate chart data by date
        const sessionsMap = new Map();
        const periodDays = period === "7d" ? 7 : period === "14d" ? 14 : period === "30d" ? 30 : 90;
        
        // Create date range for the selected period
        const dates = [];
        for (let i = 0; i < periodDays; i++) {
          const date = new Date();
          date.setDate(date.getDate() - (periodDays - i - 1));
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          dates.push(dateStr);
          sessionsMap.set(dateStr, 0);
        }
        
        // Count sessions per date
        sessions.forEach(session => {
          const sessionDate = new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (sessionsMap.has(sessionDate)) {
            sessionsMap.set(sessionDate, sessionsMap.get(sessionDate) + 1);
          }
        });
        
        // Convert map to array for chart
        const chartDataArray = Array.from(sessionsMap.entries()).map(([date, chats]) => ({
          date,
          chats
        }));
        
        setChartData(chartDataArray);
        
        // Calculate statistics
        const totalChats = sessions.length;
        const aiResolutions = sessions.filter(s => !s.escalatedToHuman).length;
        const humanEscalations = totalChats - aiResolutions;
        
        // Calculate average response time (assuming we have this data)
        let totalResponseTime = 0;
        let responseCount = 0;
        
        sessions.forEach(session => {
          if (session.messages && session.messages.length > 1) {
            for (let i = 1; i < session.messages.length; i += 2) {
              const userMsg = session.messages[i-1];
              const botMsg = session.messages[i];
              if (userMsg && botMsg && userMsg.sender === 'user' && botMsg.sender === 'assistant') {
                const userTime = new Date(userMsg.timestamp).getTime();
                const botTime = new Date(botMsg.timestamp).getTime();
                totalResponseTime += (botTime - userTime);
                responseCount++;
              }
            }
          }
        });
        
        const avgResponseTimeMs = responseCount > 0 ? totalResponseTime / responseCount : 0;
        const avgResponseTimeSec = (avgResponseTimeMs / 1000).toFixed(1);
        
        // Get widget count as a proxy for document count
        const widgetsResponse = await getUserWidgets();
        const documentCount = widgetsResponse.data.length;
        
        setStatistics({
          totalChats,
          aiResolutions,
          humanEscalations,
          averageResponseTime: `${avgResponseTimeSec}s`,
          documentCount
        });
        
        // For superadmin, fetch real data from the backend
        if (isSuperAdmin) {
          try {
            // Fetch system stats for admin dashboard
            const statsResponse = await getSystemStats();
            if (statsResponse.data) {
              setAdminStats({
                totalUsers: statsResponse.data.totalUsers || 0,
                newUsersToday: statsResponse.data.newUsersToday || 0,
                activeUsers: statsResponse.data.activeUsers || 0,
                premiumUsers: statsResponse.data.premiumUsers || 0,
              });
              
              // Set signup data if available
              if (statsResponse.data.signupData && statsResponse.data.signupData.length) {
                setSignupData(statsResponse.data.signupData);
              }
              
              // Set user plan distribution if available
              if (statsResponse.data.userPlanDistribution) {
                const planData = [
                  { name: "Free", value: statsResponse.data.userPlanDistribution.free || 0 },
                  { name: "Basic", value: statsResponse.data.userPlanDistribution.basic || 0 },
                  { name: "Premium", value: statsResponse.data.userPlanDistribution.premium || 0 },
                ];
                setUserPlanData(planData);
              }
            }
            
            // Fetch recent users
            const usersResponse = await getAllUsers(1, 5); // Get first page with 5 users
            if (usersResponse.data && usersResponse.data.users) {
              setRecentUsers(usersResponse.data.users);
            }
          } catch (adminError) {
            console.error("Failed to fetch admin data", adminError);
            // Keep fallback data in case of error
          }
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
        // Keep fallback data in case of error
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [period, isSuperAdmin]);

  // Customize the tooltip to make it look better
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-sm rounded-md">
          <p className="font-medium">{label}</p>
          <p className="text-primary">{`${payload[0].value} ${payload[0].name}`}</p>
        </div>
      );
    }
    return null;
  };

  const userRole = localStorage.getItem("user_role");
  const authToken = localStorage.getItem("auth_token")?.substring(0, 20) + "...";
  const isAdminUser = 
    userRole === "superadmin" || 
    userRole === "Admin" || 
    userRole === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-600">
            {isSuperAdmin 
              ? "Welcome to your SuperAdmin Dashboard" 
              : "Welcome to your AI Chat Widget Dashboard"}
          </p>
        </div>
        
        {isSuperAdmin && (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 px-2 py-1">
            SuperAdmin View
          </Badge>
        )}
      </div>

      {/* SuperAdmin Statistics Cards */}
      {isSuperAdmin && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
                  <p className="text-3xl font-bold mt-1">{adminStats.totalUsers}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">New Users Today</h3>
                  <p className="text-3xl font-bold mt-1">{adminStats.newUsersToday}</p>
                </div>
                <UserPlus className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
                  <p className="text-3xl font-bold mt-1">{adminStats.activeUsers}</p>
                </div>
                <Activity className="h-8 w-8 text-purple-500 opacity-80" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Premium Users</h3>
                  <p className="text-3xl font-bold mt-1">{adminStats.premiumUsers}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-amber-500 opacity-80" />
              </div>
            </Card>
          </div>
          
          {/* Super Admin Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-lg font-medium">New Signups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={signupData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="signups" name="signups" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-lg font-medium">User Plan Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={userPlanData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {userPlanData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Recent Users</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Chats</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge className={
                          user.plan === "Premium" 
                            ? "bg-blue-100 text-blue-800 hover:bg-blue-100" 
                            : user.plan === "Basic" 
                              ? "bg-green-100 text-green-800 hover:bg-green-100" 
                              : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                        }>
                          {user.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.chats}</TableCell>
                      <TableCell>{user.joined}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Regular Dashboard Content */}
      <div className={isSuperAdmin ? "border-t pt-6 mt-6" : ""}>
        {isSuperAdmin && (
          <h2 className="text-xl font-bold mb-4">Chat Widget Statistics</h2>
        )}
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total Chats</h3>
                <p className="text-3xl font-bold mt-1">{statistics.totalChats}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary opacity-80" />
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">AI Resolutions</h3>
            <p className="text-3xl font-bold mt-1">
              {statistics.aiResolutions}{" "}
              <span className="text-sm font-normal text-gray-500">
                ({statistics.totalChats > 0 ? Math.round((statistics.aiResolutions / statistics.totalChats) * 100) : 0}%)
              </span>
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Human Escalations</h3>
            <p className="text-3xl font-bold mt-1">
              {statistics.humanEscalations}{" "}
              <span className="text-sm font-normal text-gray-500">
                ({statistics.totalChats > 0 ? Math.round((statistics.humanEscalations / statistics.totalChats) * 100) : 0}%)
              </span>
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Avg. Response Time</h3>
            <p className="text-3xl font-bold mt-1">{statistics.averageResponseTime}</p>
          </Card>
        </div>

        {/* Chart */}
        <Card className="p-4 mt-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold">Chat Volume</h3>
            <Tabs defaultValue="14d" onValueChange={(value) => setPeriod(value as any)}>
              <TabsList>
                <TabsTrigger value="7d">7d</TabsTrigger>
                <TabsTrigger value="14d">14d</TabsTrigger>
                <TabsTrigger value="30d">30d</TabsTrigger>
                <TabsTrigger value="90d">90d</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9b87f5" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#9b87f5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" />
                <YAxis />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="chats"
                  stroke="#9b87f5"
                  fillOpacity={1}
                  fill="url(#colorChats)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Embed Code Generator */}
        {!isSuperAdmin && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Your Chat Widget</h2>
            <EmbedCodeGenerator
              botName="AI Assistant"
              primaryColor="#9b87f5"
              welcomeMessage="Hi there! 👋 How can I help you today?"
              position="bottom-right"
            />
          </div>
        )}

        {isAdminUser && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Admin Debugging Info</h3>
            <div className="space-y-2 text-sm font-mono">
              <div>User Role: {userRole}</div>
              <div>Auth Token: {authToken}</div>
              <div>Is Admin: {isAdminUser ? "Yes" : "No"}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
