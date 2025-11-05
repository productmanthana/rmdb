import { useState } from "react";
import { ChartConfig } from "@shared/schema";
import { ChartVisualization } from "./ChartVisualization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid2x2, Maximize2 } from "lucide-react";

interface ChartComparisonProps {
  config: ChartConfig;
}

export function ChartComparison({ config }: ChartComparisonProps) {
  const [viewMode, setViewMode] = useState<"single" | "split">("single");

  // Check if data is in point format (for scatter/bubble charts)
  const hasPointData = config.datasets.some((dataset) => 
    Array.isArray(dataset.data) && 
    dataset.data.length > 0 && 
    typeof dataset.data[0] === "object" && 
    dataset.data[0] !== null &&
    "x" in dataset.data[0] && 
    "y" in dataset.data[0]
  );

  // Only allow chart types compatible with the data format
  // Point data (scatter/bubble) is only compatible with scatter/bubble charts
  // Numeric data works with bar, line, area, pie, doughnut, radar
  const chartTypes: Array<ChartConfig["type"]> = hasPointData
    ? ["scatter", "bubble"]
    : ["bar", "line", "pie", "doughnut"];
  
  const chartConfigs = chartTypes.map((type) => ({
    ...config,
    type,
    title: `${config.title} (${type.charAt(0).toUpperCase() + type.slice(1)})`,
  }));

  if (viewMode === "single") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/90 dark:text-white">Visualization</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewMode("split")}
            data-testid="button-toggle-comparison"
            className="text-white border-white/30 hover:bg-white/10 hover:text-white"
          >
            <Grid2x2 className="h-4 w-4 mr-2" />
            Compare Views
          </Button>
        </div>
        <ChartVisualization config={config} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/90 dark:text-white">Chart Comparison</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setViewMode("single")}
          data-testid="button-toggle-single"
          className="text-white border-white/30 hover:bg-white/10 hover:text-white"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          Single View
        </Button>
      </div>
      <Tabs defaultValue="grid" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="grid" data-testid="tab-grid-view">
            Grid View
          </TabsTrigger>
          <TabsTrigger value="tabs" data-testid="tab-tabs-view">
            Tab View
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="grid" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chartConfigs.map((chartConfig, index) => (
              <div key={index} className="min-h-[400px]">
                <ChartVisualization config={chartConfig} />
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="tabs" className="space-y-4">
          <Tabs defaultValue="0" className="w-full">
            <TabsList className="w-full justify-start">
              {chartTypes.map((type, index) => (
                <TabsTrigger key={index} value={index.toString()} data-testid={`tab-chart-${type}`}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
            {chartConfigs.map((chartConfig, index) => (
              <TabsContent key={index} value={index.toString()}>
                <ChartVisualization config={chartConfig} />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
