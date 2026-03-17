import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import UserPage from "@/pages/user";
import AppBuilderWorkspace from "@/pages/AppBuilderWorkspace";
import Dashboard from "@/pages/Dashboard";
import FileExplorer from "@/pages/FileExplorer";
import IDE from "@/pages/IDE";
import EngineStudio from "@/pages/EngineStudio";
import LibraryCatalog from "@/pages/LibraryCatalog";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/library" component={LibraryCatalog} />
      <Route path="/engine" component={EngineStudio} />
      <Route path="/files" component={FileExplorer} />
      <Route path="/ide" component={IDE} />
      <Route path="/workspace/:id">
        {(params) => <AppBuilderWorkspace params={params} />}
      </Route>
      <Route path="/workspace" component={AppBuilderWorkspace} />
      <Route path="/builder" component={AppBuilderWorkspace} />
      <Route path="/chat" component={Home} />
      <Route path="/user" component={UserPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark" dir="rtl">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
