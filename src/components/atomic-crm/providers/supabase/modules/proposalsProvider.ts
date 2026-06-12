import type { Identifier } from "ra-core";
import { invokeEdgeFunction } from "../invokeEdgeFunction";
import { supabase } from "../supabase";

export const proposalsProvider = {
  async acceptProposal({ id }: { id: Identifier }) {
    const { data, error } = await invokeEdgeFunction<{
      deal_id: number;
      proposal_id: number;
      contract_id?: number | null;
    }>("accept_proposal", {
      method: "POST",
      body: { proposal_id: id },
    });

    if (error || !data?.deal_id) {
      console.error("accept_proposal.error", error);
      throw new Error("Failed to accept proposal");
    }

    return data;
  },
  async sendProposal({ id }: { id: Identifier }) {
    const { data, error } = await invokeEdgeFunction<{
      token: string;
      short_code: string;
      url: string;
      short_url: string;
      expires_at: string;
      proposal_id: number;
    }>("send_proposal", {
      method: "POST",
      body: {
        proposal_id: id,
        base_url: window.location.origin,
      },
    });

    if (error || !data?.token) {
      console.error("send_proposal.error", error);
      throw new Error("Failed to send proposal");
    }

    return data;
  },
  async getPublicDealBrief(payload: {
    dealId: string | number;
    companyId: string | number;
    contactId: string | number;
  }) {
    const { data, error } = await supabase.functions.invoke<{
      project_type?: string | null;
      expected_end_date?: string | null;
      website_brief?: Record<string, string | null>;
    }>("get_public_deal_brief", {
      body: {
        deal_id: Number(payload.dealId),
        company_id: Number(payload.companyId),
        contact_id: Number(payload.contactId),
      },
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      },
    });

    if (error || !data) {
      console.error("get_public_deal_brief.error", error);
      throw new Error("Failed to load project brief");
    }

    return data;
  },
};
