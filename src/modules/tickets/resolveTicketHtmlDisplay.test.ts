import { describe, expect, it } from "vitest";
import { resolveTicketHtmlDisplay } from "@/modules/tickets/resolveTicketHtmlDisplay";

describe("resolveTicketHtmlDisplay", () => {
  it("collapses Gmail-quoted reply history behind a split", () => {
    const html = `<div>Hi team,<br>Please add siding to the estimate.</div><div class="gmail_quote"><div>On Jul 1, 2026, LBS wrote:</div><blockquote>Previous estimate line one. Previous estimate line two. Previous estimate line three.</blockquote></div>`;

    const display = resolveTicketHtmlDisplay(html);

    expect(display.mode).toBe("split");
    if (display.mode !== "split") return;
    expect(display.content).toContain("Please add siding");
    expect(display.content).not.toContain("Previous estimate");
    expect(display.quoted).toContain("gmail_quote");
    expect(display.quoted).toContain("Previous estimate");
  });

  it("keeps forwarded-style emails fully visible", () => {
    const signature =
      '<div><img src="logo.png" alt="Eagle Sky" width="400" height="120" /><p>Eagle Sky Insurance</p></div>';
    const forwarded =
      '<div class="gmail_quote"><div>---------- Forwarded message ---------</div><p>Dear team, please review policy PP0021408340.</p><p>Hartford Insurance Group</p><ul><li>Coverage details for the claim</li></ul></div>';
    const html = `${signature}${forwarded}`;

    const display = resolveTicketHtmlDisplay(html);

    expect(display.mode).toBe("full");
    if (display.mode !== "full") return;
    expect(display.html).toContain("Forwarded message");
    expect(display.html).toContain("PP0021408340");
  });

  it("keeps HTML without a quote block fully visible", () => {
    const html =
      "<div><p>Thanks for the update. We will schedule the site visit next week.</p></div>";

    const display = resolveTicketHtmlDisplay(html);

    expect(display).toEqual({ mode: "full", html });
  });
});
