import { describe, expect, it } from "vitest";
import {
  projectTypeShowsDomainHosting,
  projectTypeShowsGithub,
  projectTypeShowsServiceDetails,
  projectTypeShowsWebsiteUrl,
} from "@/modules/deals/lbsProjectConstants";

describe("project type service-detail visibility", () => {
  it("shows full tech block for website", () => {
    expect(projectTypeShowsWebsiteUrl("website")).toBe(true);
    expect(projectTypeShowsDomainHosting("website")).toBe(true);
    expect(projectTypeShowsGithub("website")).toBe(true);
    expect(projectTypeShowsServiceDetails("website")).toBe(true);
  });

  it("shows only current website for SEO", () => {
    expect(projectTypeShowsWebsiteUrl("seo")).toBe(true);
    expect(projectTypeShowsDomainHosting("seo")).toBe(false);
    expect(projectTypeShowsGithub("seo")).toBe(false);
    expect(projectTypeShowsServiceDetails("seo")).toBe(true);
  });

  it("hides tech block for branding", () => {
    expect(projectTypeShowsWebsiteUrl("branding")).toBe(false);
    expect(projectTypeShowsDomainHosting("branding")).toBe(false);
    expect(projectTypeShowsGithub("branding")).toBe(false);
    expect(projectTypeShowsServiceDetails("branding")).toBe(false);
  });

  it("shows domain/hosting without GitHub for maintenance", () => {
    expect(projectTypeShowsWebsiteUrl("maintenance")).toBe(true);
    expect(projectTypeShowsDomainHosting("maintenance")).toBe(true);
    expect(projectTypeShowsGithub("maintenance")).toBe(false);
  });
});
