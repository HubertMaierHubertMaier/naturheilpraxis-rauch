import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { KnowledgeBaseManager } from "@/components/admin/KnowledgeBaseManager";

const Wissensdatenbank = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminCheck();

  if (authLoading || adminLoading) {
    return (
      <Layout>
        <div className="container py-12">
          <Skeleton className="h-12 w-64 mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <Layout>
      <div className="container py-8">
        <KnowledgeBaseManager />
      </div>
    </Layout>
  );
};

export default Wissensdatenbank;
