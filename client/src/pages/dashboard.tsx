import { useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { DollarSign, TrendingUp, Award, BarChart3, GripVertical } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FloatingParticles } from "@/components/FloatingParticles";

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
  Title,
  ChartDataLabels
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

interface ChartCard {
  id: string;
  title: string;
  description: string;
  component: ReactNode;
  testId: string;
  number: number;
  colSpan?: string;
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

  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [chartOrder, setChartOrder] = useState<string[]>([
    'size', 'status', 'category', 'geographic', 'timeline', 'winrate', 'topprojects'
  ]);

  // Persist order to localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem('dashboardChartOrder');
    if (savedOrder) {
      try {
        setChartOrder(JSON.parse(savedOrder));
      } catch (e) {
        // Use default order if parsing fails
      }
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCard(cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetCardId: string) => {
    e.preventDefault();
    
    if (!draggedCard || draggedCard === targetCardId) {
      setDraggedCard(null);
      return;
    }

    const newOrder = [...chartOrder];
    const draggedIndex = newOrder.indexOf(draggedCard);
    const targetIndex = newOrder.indexOf(targetCardId);

    // Remove dragged item and insert at target position
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedCard);

    setChartOrder(newOrder);
    localStorage.setItem('dashboardChartOrder', JSON.stringify(newOrder));
    setDraggedCard(null);
  };

  const handleDragEnd = () => {
    // Always clear the dragged card state when drag ends, even if dropped outside
    setDraggedCard(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-mesh overflow-hidden relative">
        <FloatingParticles />
        <header className="glass-dark border-b border-white/10 relative z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-8 w-48 bg-white/10" />
                <Skeleton className="h-4 w-64 mt-2 bg-white/10" />
              </div>
              <Skeleton className="h-10 w-32 bg-white/10" />
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 bg-white/10" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-96 bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen gradient-mesh overflow-hidden relative flex items-center justify-center">
        <FloatingParticles />
        <Card className="max-w-md glass-dark border-white/20 relative z-10">
          <CardHeader>
            <CardTitle className="text-white">Error Loading Dashboard</CardTitle>
            <CardDescription className="text-white/70">Failed to fetch dashboard analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-white/60 mb-4">
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              className="gradient-accent text-white hover:opacity-90"
              data-testid="button-retry"
            >
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
        labels: {
          color: 'rgba(255, 255, 255, 0.9)',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.9)',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(20, 20, 40, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
      },
      datalabels: {
        color: '#fff',
        font: {
          weight: 'bold' as const,
          size: 12,
        },
        formatter: (value: number) => {
          return value > 0 ? value : '';
        },
      },
    },
  };

  const barChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      datalabels: {
        color: '#fff',
        anchor: 'end' as const,
        align: 'end' as const,
        font: {
          weight: 'bold' as const,
          size: 11,
        },
        formatter: (value: number) => {
          return value > 0 ? value : '';
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        beginAtZero: true,
      },
    },
  };

  const lineChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      datalabels: {
        color: '#fff',
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 4,
        padding: 4,
        font: {
          weight: 'bold' as const,
          size: 10,
        },
        formatter: (value: number) => {
          return value > 0 ? value : '';
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        beginAtZero: true,
      },
    },
  };

  const winRateChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      datalabels: {
        color: '#fff',
        anchor: 'end' as const,
        align: 'top' as const,
        offset: 4,
        font: {
          weight: 'bold' as const,
          size: 11,
        },
        formatter: (value: number) => {
          return value > 0 ? `${value.toFixed(1)}%` : '';
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        beginAtZero: true,
        max: 100,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: function(value: any) {
            return value + '%';
          },
        },
      },
    },
  };

  // Define all chart cards with numbers
  const allChartCards: Record<string, ChartCard> = {
    size: {
      id: 'size',
      number: 1,
      title: 'Project Distribution by Size',
      description: 'Number of projects in each size category',
      testId: 'chart-size-distribution',
      component: (
        <div className="h-80">
          <Doughnut data={sizeChartData} options={pieChartOptions} />
        </div>
      ),
    },
    status: {
      id: 'status',
      number: 2,
      title: 'Projects by Status',
      description: 'Current status of all projects',
      testId: 'chart-status-distribution',
      component: (
        <div className="h-80">
          <Pie data={statusChartData} options={pieChartOptions} />
        </div>
      ),
    },
    category: {
      id: 'category',
      number: 3,
      title: 'Top Categories',
      description: 'Projects by request category (top 8)',
      testId: 'chart-category-distribution',
      component: (
        <div className="h-80">
          <Bar data={categoryChartData} options={barChartOptions} />
        </div>
      ),
    },
    geographic: {
      id: 'geographic',
      number: 4,
      title: 'Geographic Distribution',
      description: 'Projects by state (top 10)',
      testId: 'chart-geographic-distribution',
      component: (
        <div className="h-80">
          <Bar data={stateChartData} options={barChartOptions} />
        </div>
      ),
    },
    timeline: {
      id: 'timeline',
      number: 5,
      title: 'Project Timeline',
      description: 'Projects over the last 12 months',
      testId: 'chart-monthly-trend',
      colSpan: 'lg:col-span-2',
      component: (
        <div className="h-80">
          <Line data={monthlyTrendData} options={lineChartOptions} />
        </div>
      ),
    },
    winrate: {
      id: 'winrate',
      number: 6,
      title: 'Win Rate by Category',
      description: 'Average win percentage by category',
      testId: 'chart-win-rate',
      component: (
        <div className="h-80">
          <Bar data={winRateChartData} options={winRateChartOptions} />
        </div>
      ),
    },
    topprojects: {
      id: 'topprojects',
      number: 7,
      title: 'Top 10 Projects by Fee',
      description: 'Highest value projects',
      testId: 'table-top-projects',
      component: (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 sticky top-0 glass-dark">
              <tr className="text-left">
                <th className="pb-2 font-medium text-white">Project</th>
                <th className="pb-2 font-medium text-right text-white">Fee</th>
                <th className="pb-2 font-medium text-white">Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topProjects.map((project, idx) => (
                <tr key={idx} className="border-b border-white/5 last:border-0" data-testid={`row-project-${idx}`}>
                  <td className="py-2 text-white/70 max-w-[200px] truncate" title={project["Project Name"]}>
                    {project["Project Name"]}
                  </td>
                  <td className="py-2 text-right font-medium text-white">
                    {formatCurrency(parseFloat(project.fee))}
                  </td>
                  <td className="py-2">
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {project.Status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
  };

  return (
    <div className="min-h-screen gradient-mesh overflow-hidden relative">
      {/* Floating Particles Background */}
      <FloatingParticles />

      {/* Glassmorphic Header */}
      <header className="glass-dark border-b border-white/10 relative z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white" data-testid="text-dashboard-title">Analytics Dashboard</h1>
              <p className="text-white/60 mt-1">Comprehensive overview of all projects</p>
            </div>
            <Link href="/">
              <Button 
                variant="outline" 
                className="glass text-white hover:glass-hover border-white/20"
                data-testid="button-back-to-chat"
              >
                Back to Chat
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="glass-dark border-white/20" data-testid="card-total-projects">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Projects</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white" data-testid="text-total-projects">
                {formatNumber(parseInt(summary.total_projects))}
              </div>
              <p className="text-xs text-white/50">All time</p>
            </CardContent>
          </Card>

          <Card className="glass-dark border-white/20" data-testid="card-total-value">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white" data-testid="text-total-value">
                {formatCurrency(parseFloat(summary.total_value))}
              </div>
              <p className="text-xs text-white/50">Combined fees</p>
            </CardContent>
          </Card>

          <Card className="glass-dark border-white/20" data-testid="card-avg-fee">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Average Fee</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white" data-testid="text-avg-fee">
                {formatCurrency(parseFloat(summary.avg_fee))}
              </div>
              <p className="text-xs text-white/50">Per project</p>
            </CardContent>
          </Card>

          <Card className="glass-dark border-white/20" data-testid="card-avg-win-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Avg Win Rate</CardTitle>
              <Award className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white" data-testid="text-avg-win-rate">
                {parseFloat(summary.avg_win_rate).toFixed(1)}%
              </div>
              <p className="text-xs text-white/50">Success rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Draggable Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chartOrder.map((cardId) => {
            const card = allChartCards[cardId];
            if (!card) return null;

            return (
              <Card
                key={card.id}
                className={`glass-dark border-white/20 cursor-move hover:border-white/40 transition-all ${
                  draggedCard === card.id ? 'opacity-50' : ''
                } ${card.colSpan || ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, card.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, card.id)}
                onDragEnd={handleDragEnd}
                data-testid={card.testId}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold">
                          {card.number}
                        </div>
                        <CardTitle className="text-white text-lg">{card.title}</CardTitle>
                      </div>
                      <CardDescription className="text-white/60">{card.description}</CardDescription>
                    </div>
                    <GripVertical className="h-5 w-5 text-white/40 shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  {card.component}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
