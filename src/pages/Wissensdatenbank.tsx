import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { KnowledgeBaseManager } from "@/components/admin/KnowledgeBaseManager";
import { PathogenIndex } from "@/components/admin/PathogenIndex";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Bug, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TherapyRecommendation } from "@/components/admin/TherapyRecommendation";

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  created_at: string;
  updated_at: string;
}

const Wissensdatenbank = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("wiki");
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchEntries = async () => {
      setEntriesLoading(true);
      const { data } = await supabase
        .from("admin_knowledge_base")
        .select("*")
        .order("updated_at", { ascending: false });
      setEntries((data as KnowledgeEntry[]) || []);
      setEntriesLoading(false);
    };
    fetchEntries();
  }, [isAdmin]);

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-12">
          <Skeleton className="h-12 w-64 mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!user && !isAdmin) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <Layout>
      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="wiki" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Wiki
            </TabsTrigger>
            <TabsTrigger value="pathogene" className="gap-2">
              <Bug className="h-4 w-4" />
              Pathogen-Verzeichnis
            </TabsTrigger>
          </TabsList>
          <TabsContent value="wiki">
            <KnowledgeBaseManager />
          </TabsContent>
          <TabsContent value="pathogene">
            <PathogenIndex entries={entries} loading={entriesLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Wissensdatenbank;
