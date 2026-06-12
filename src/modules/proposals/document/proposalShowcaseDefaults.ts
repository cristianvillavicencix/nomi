import type {
  ProposalAboutStats,
  ProposalDocumentContent,
  ProposalPortfolioItem,
  ProposalTeamMember,
} from "@/modules/proposals/document/proposalDocumentTypes";
import { DEFAULT_PROPOSAL_TIMELINE_BARS } from "@/modules/proposals/document/proposalTimeline";

export const DEFAULT_PROPOSAL_PORTFOLIO: ProposalPortfolioItem[] = [
  {
    id: "portfolio-1",
    title: "Landscaping client",
    subtitle: "Landscaping · Connecticut",
    image_url: "",
  },
  {
    id: "portfolio-2",
    title: "Roofing client",
    subtitle: "Roofing · Connecticut",
    image_url: "",
  },
  {
    id: "portfolio-3",
    title: "Remodeling client",
    subtitle: "Remodeling · New York",
    image_url: "",
  },
];

export const DEFAULT_PROPOSAL_TEAM: ProposalTeamMember[] = [
  {
    id: "team-1",
    name: "Cristian Villavicencio",
    role: "Founder & CEO",
    bio: "Leads strategy, client relationships, and delivery for contractor and home-service brands.",
    image_url: "",
  },
  {
    id: "team-2",
    name: "María López",
    role: "Lead Designer",
    bio: "Owns visual design, UX, and brand consistency across web projects.",
    image_url: "",
  },
  {
    id: "team-3",
    name: "Javier Ríos",
    role: "Developer",
    bio: "Builds fast, maintainable sites with modern stacks and clean handoff.",
    image_url: "",
  },
  {
    id: "team-4",
    name: "Ana Soto",
    role: "SEO & Marketing",
    bio: "Drives local SEO, analytics, and ongoing growth after launch.",
    image_url: "",
  },
];

export const DEFAULT_ABOUT_STATS: ProposalAboutStats = {
  websites: "120+",
  years: "8 yrs",
  leads: "3.4×",
  retention: "98%",
};

export const attachProposalShowcaseDefaults = (
  content: ProposalDocumentContent,
): ProposalDocumentContent => ({
  ...content,
  portfolio_items:
    content.portfolio_items?.length ? content.portfolio_items : DEFAULT_PROPOSAL_PORTFOLIO,
  team_members: content.team_members?.length ? content.team_members : DEFAULT_PROPOSAL_TEAM,
  client_logos: content.client_logos ?? [],
  about_stats: content.about_stats ?? DEFAULT_ABOUT_STATS,
  timeline_bars: content.timeline_bars?.length
    ? content.timeline_bars
    : DEFAULT_PROPOSAL_TIMELINE_BARS,
});
