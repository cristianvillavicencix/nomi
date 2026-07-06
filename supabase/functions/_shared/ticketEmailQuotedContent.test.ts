import { describe, expect, it } from "vitest";
import {
  splitHtmlEmail,
  splitPlainTextEmail,
  stripQuotedHtml,
  stripQuotedPlainText,
  isForwardedStyleEmail,
} from "./ticketEmailQuotedContent.ts";

describe("ticketEmailQuotedContent", () => {
  it("keeps only the new reply in Spanish plain-text threads", () => {
    const input = `Hola Chicos Buenos Dias

Me ayudan agregando los siguientes Items para este estimado:

Wall / Apron Flasing
D&R Siding

Saludos !!

El 25/06/2026 a las 11:56, LBS Supplements escribió:
> Previous estimate content
> Line two`;

    const split = splitPlainTextEmail(input);
    expect(split.content).toContain("Wall / Apron Flasing");
    expect(split.content).not.toContain("Previous estimate");
    expect(split.quoteHeader).toContain("LBS Supplements");
    expect(stripQuotedPlainText(input)).toBe(split.content);
  });

  it("splits gmail_quote HTML blocks", () => {
    const input = `<div>Hi team,<br>Please add siding.</div><div class="gmail_quote"><div>On Jul 1, 2026, LBS wrote:</div><blockquote>Old body</blockquote></div>`;
    const split = splitHtmlEmail(input);
    expect(split.content).toContain("Please add siding");
    expect(split.quoted).toContain("gmail_quote");
    expect(stripQuotedHtml(input)).toBe(split.content);
  });

  it("detects forwarded emails with thin main content", () => {
    const signature =
      '<div><img src="logo.png" alt="Eagle Sky" width="400" height="120" /><p>Eagle Sky Insurance</p></div>';
    const forwarded =
      '<div class="gmail_quote"><div>---------- Forwarded message ---------</div><p>Dear team, please review policy PP0021408340.</p><p>Hartford Insurance Group</p><ul><li>Coverage details</li></ul></div>';
    const input = `${signature}${forwarded}`;

    expect(isForwardedStyleEmail(input)).toBe(true);
    expect(splitHtmlEmail(input).quoted).toContain("Forwarded message");
  });
});
