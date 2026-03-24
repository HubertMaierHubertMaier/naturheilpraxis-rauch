import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { KnowledgeBaseManager } from "@/components/admin/KnowledgeBaseManager";

const Wissensdatenbank = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();

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

  // Allow access if logged in as admin OR dev bypass is active
  if (!user && !isAdmin) return <Navigate to="/auth" replace />;
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
