import type React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { FeaturesSection } from "@/components/home/FeaturesSection";

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {ui}
    </MemoryRouter>
  );
}

describe("public Anamnese link surface characterization", () => {
  it("no longer exposes an anamnesis link in the footer navigation", () => {
    renderWithRouter(<Footer />);

    expect(
      screen.queryByRole("link", {
        name: /^Anamnesebogen$/i,
      })
    ).not.toBeInTheDocument();
  });

  it("keeps the home feature Anamnesebogen card pointed at the online route", () => {
    renderWithRouter(<FeaturesSection />);

    const featureCard = screen.getByRole("link", {
      name: /Anamnesebogen\s+Füllen Sie Ihren persönlichen Gesundheitsfragebogen bequem von zu Hause aus\.\s+Mehr erfahren/i,
    });

    expect(featureCard).toHaveAttribute("href", "/anamnesebogen");
    expect(featureCard).not.toHaveAttribute("download");
  });
});
