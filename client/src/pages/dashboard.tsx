import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title } from 'chart.js';
import { DollarSign, TrendingUp, Award, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title
);

interface DashboardData {
  summary: {
    total_projects: string;
    total_value: string;
    avg_fee: string;
    avg_win_rate: string;
  };
  sizeDistribution: Array<{ size: string; count: string; total_value: string }>;
  statusDistribution: Array<{ Status: string; count: string; total_value: string }>;
  categoryDistribution: Array<{ category: string; count: string; total_value: string }>;
  stateDistribution: Array<{ state: string; count: string; total_value: string }>;
  monthlyTrend: Array<{ month: string; count: string; total_value: string }>;
  topProjects: Array<{ "Project Name": string; fee: string; Status: string; category: string }>;
  winRateByCategory: Array<{ category: string; total_projects: string; avg_win_rate: string; total_value: string }>;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  } else if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ["/api/dashboard/analytics"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Dashboard</CardTitle>
            <CardDescription>Failed to fetch dashboard analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-retry">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analytics = data.data;
  const summary = analytics.summary;

  // Chart color schemes
  const primaryColors = [
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(16, 185, 129, 0.8)',   // green
    'rgba(249, 115, 22, 0.8)',   // orange
    'rgba(239, 68, 68, 0.8)',    // red
    'rgba(168, 85, 247, 0.8)',   // purple
    'rgba(236, 72, 153, 0.8)',   // pink
    'rgba(245, 158, 11, 0.8)',   // amber
    'rgba(20, 184, 166, 0.8)',   // teal
  ];

  const borderColors = primaryColors.map(c => c.replace('0.8', '1'));

  // Size distribution chart data
  const sizeChartData = {
    labels: analytics.sizeDistribution.map(d => d.size),
    datasets: [{
      label: 'Projects',
      data: analytics.sizeDistribution.map(d => parseInt(d.count)),
      backgroundColor: primaryColors.slice(0, analytics.sizeDistribution.length),
      borderColor: borderColors.slice(0, analytics.sizeDistribution.length),
      borderWidth: 1,
    }],
  };

  // Status distribution chart data
  const statusChartData = {
    labels: analytics.statusDistribution.map(d => d.Status),
    datasets: [{
      label: 'Projects',
      data: analytics.statusDistribution.map(d => parseInt(d.count)),
      backgroundColor: primaryColors,
      borderColor: borderColors,
      borderWidth: 1,
    }],
  };

  // Category distribution chart data (top 8)
  const categoryChartData = {
    labels: analytics.categoryDistribution.slice(0, 8).map(d => d.category),
    datasets: [{
      label: 'Projects',
      data: analytics.categoryDistribution.slice(0, 8).map(d => parseInt(d.count)),
      backgroundColor: primaryColors,
      borderColor: borderColors,
      borderWidth: 2,
    }],
  };

  // Geographic distribution (top 10)
  const stateChartData = {
    labels: analytics.stateDistribution.slice(0, 10).map(d => d.state),
    datasets: [{
      label: 'Projects',
      data: analytics.stateDistribution.slice(0, 10).map(d => parseInt(d.count)),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1,
    }],
  };

  // Monthly trend chart data
  const monthlyTrendData = {
    labels: analytics.monthlyTrend.map(d => d.month),
    datasets: [{
      label: 'Project Count',
      data: analytics.monthlyTrend.map(d => parseInt(d.count)),
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      fill: true,
      tension: 0.4,
    }],
  };

  // Win rate by category
  const winRateChartData = {
    labels: analytics.winRateByCategory.map(d => d.category),
    datasets: [{
      label: 'Avg Win Rate (%)',
      data: analytics.winRateByCategory.map(d => parseFloat(d.avg_win_rate)),
      backgroundColor: 'rgba(16, 185, 129, 0.8)',
      borderColor: 'rgba(16, 185, 129, 1)',
      borderWidth: 1,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">Analytics Dashboard</h1>
              <p className="text-muted-foreground mt-1">Comprehensive overview of all projects</p>
            </div>
            <Link href="/">
              <Button variant="outline" data-testid="button-back-to-chat">
                Back to Chat
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card data-testid="card-total-projects">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-projects">
                {formatNumber(parseInt(summary.total_projects))}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-value">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-value">
                {formatCurrency(parseFloat(summary.total_value))}
              </div>
              <p className="text-xs text-muted-foreground">Combined fees</p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-fee">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Fee</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-fee">
                {formatCurrency(parseFloat(summary.avg_fee))}
              </div>
              <p className="text-xs text-muted-foreground">Per project</p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-win-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Win Rate</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-win-rate">
                {parseFloat(summary.avg_win_rate).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Success rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Size Distribution */}
          <Card data-testid="chart-size-distribution">
            <CardHeader>
              <CardTitle>Project Distribution by Size</CardTitle>
              <CardDescription>Number of projects in each size category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Doughnut data={sizeChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card data-testid="chart-status-distribution">
            <CardHeader>
              <CardTitle>Projects by Status</CardTitle>
              <CardDescription>Current status of all projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Pie data={statusChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card data-testid="chart-category-distribution">
            <CardHeader>
              <CardTitle>Top Categories</CardTitle>
              <CardDescription>Projects by request category (top 8)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Bar data={categoryChartData} options={barChartOptions} />
              </div>
            </CardContent>
          </Card>

          {/* Geographic Distribution */}
          <Card data-testid="chart-geographic-distribution">
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
              <CardDescription>Projects by state (top 10)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Bar data={stateChartData} options={barChartOptions} />
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card data-testid="chart-monthly-trend" className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Project Timeline</CardTitle>
              <CardDescription>Projects over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Line data={monthlyTrendData} options={barChartOptions} />
              </div>
            </CardContent>
          </Card>

          {/* Win Rate by Category */}
          <Card data-testid="chart-win-rate">
            <CardHeader>
              <CardTitle>Win Rate by Category</CardTitle>
              <CardDescription>Average win percentage by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Bar data={winRateChartData} options={barChartOptions} />
              </div>
            </CardContent>
          </Card>

          {/* Top Projects */}
          <Card data-testid="table-top-projects">
            <CardHeader>
              <CardTitle>Top 10 Projects by Fee</CardTitle>
              <CardDescription>Highest value projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="border-b sticky top-0 bg-card">
                    <tr className="text-left">
                      <th className="pb-2 font-medium">Project</th>
                      <th className="pb-2 font-medium text-right">Fee</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topProjects.map((project, idx) => (
                      <tr key={idx} className="border-b last:border-0" data-testid={`row-project-${idx}`}>
                        <td className="py-2 text-muted-foreground max-w-[200px] truncate" title={project["Project Name"]}>
                          {project["Project Name"]}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {formatCurrency(parseFloat(project.fee))}
                        </td>
                        <td className="py-2">
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                            {project.Status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
