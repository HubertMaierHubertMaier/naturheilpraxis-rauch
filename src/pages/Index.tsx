import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { WelcomeSelection } from "@/components/home/WelcomeSelection";
import { InfoSection } from "@/components/home/InfoSection";
import SEOHead from "@/components/seo/SEOHead";

const Index = () => {
  return (
    <Layout>
      <SEOHead />
      <HeroSection />
      <WelcomeSelection />
      <InfoSection />
    </Layout>
  );
};

export default Index;
