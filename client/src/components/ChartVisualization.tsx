import { ChartConfig } from "@shared/schema";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartVisualizationProps {
  config: ChartConfig;
}

export function ChartVisualization({ config }: ChartVisualizationProps) {
  const chartData = {
    labels: config.labels,
    datasets: config.datasets.map((dataset) => ({
      ...dataset,
      label: dataset.label || "Value",
      backgroundColor: dataset.backgroundColor || "rgba(54, 162, 235, 0.6)",
      borderColor: dataset.borderColor || "rgba(54, 162, 235, 1)",
      borderWidth: dataset.borderWidth || 1,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: config.type === "pie",
        position: "top" as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
              }).format(context.parsed.y);
            } else if (context.parsed !== null) {
              label += new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
              }).format(context.parsed);
            }
            return label;
          },
        },
      },
    },
    scales:
      config.type !== "pie"
        ? {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function (value: any) {
                  return new Intl.NumberFormat("en-US", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(value);
                },
              },
            },
            x: {
              ticks: {
                maxRotation: 45,
                minRotation: 45,
              },
            },
          }
        : undefined,
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl">{config.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="aspect-video">
          {config.type === "bar" && <Bar data={chartData} options={options} />}
          {config.type === "line" && <Line data={chartData} options={options} />}
          {config.type === "pie" && (
            <div className="aspect-square max-w-md mx-auto">
              <Pie data={chartData} options={options} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
