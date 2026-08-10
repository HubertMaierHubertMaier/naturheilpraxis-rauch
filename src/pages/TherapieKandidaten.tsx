import { Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { TherapyRecommendation } from "@/components/admin/TherapyRecommendation";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function TherapieKandidaten() {
  const { user, loading, isAdmin, roleChecked } = useAuth();

  if (loading || (user && !roleChecked)) {
    return <div className="container py-12"><Skeleton className="h-96 w-full" /></div>;
  }
  if (!user && !isAdmin) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <Layout><TherapyRecommendation /></Layout>;
}
