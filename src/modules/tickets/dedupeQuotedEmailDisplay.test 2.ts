import { describe, expect, it } from "vitest";
import {
  dedupeQuotedHtmlForDisplay,
  dedupeQuotedPlainForDisplay,
  hasRepeatedPlainContent,
  stripTrailingDuplicateOfQuoted,
} from "@/modules/tickets/dedupeQuotedEmailDisplay";

describe("dedupeQuotedEmailDisplay", () => {
  it("detects repeated greeting content after quote headers", () => {
    const plainWall =
      "Hola Brenda, Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512.";
    const formatted =
      "Hola Brenda,\n\nLe compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512.\n\nSaludos cordiales,";
    const text = `On Thu, Jun 25, 2026 at 11:56 AM Latinos Business Support wrote:\n${plainWall}\n\n${formatted}`;

    expect(hasRepeatedPlainContent(text)).toBe(true);
  });

  it("removes duplicate plain and formatted quoted HTML blocks", () => {
    const plainWall =
      "Hola Brenda, Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512. Esta actualización fue realizada en base a los nuevos datos o archivos que nos compartió.";
    const formatted = `<p>Hola Brenda,</p><p>Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512.</p><p>Esta actualización fue realizada en base a los nuevos datos o archivos que nos compartió.</p><table><tr><td>Latinos Business Support</td></tr></table>`;
    const html = `<div>${plainWall}</div><div>${formatted}</div>`;

    const result = dedupeQuotedHtmlForDisplay(html);
    expect(result).toContain("<p>Hola Brenda,</p>");
    expect(result).toContain("<table>");
    expect(result).not.toContain(`${plainWall}</div><div>`);
  });

  it("removes gmail blockquote plain wall before formatted sibling", () => {
    const plainWall =
      "Hola Brenda, Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512. Esta actualización fue realizada en base a los nuevos datos o archivos que nos compartió.";
    const formatted = `<div dir="ltr"><p>Hola Brenda,</p><p>Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512.</p><p>Esta actualización fue realizada en base a los nuevos datos o archivos que nos compartió.</p><table><tr><td>Latinos Business Support</td></tr></table></div>`;
    const html = `<div class="gmail_quote"><div class="gmail_attr">On Thu, Jun 25, 2026 at 11:56 AM Latinos Business Support wrote:</div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">${plainWall}</blockquote>${formatted}</div>`;

    const result = dedupeQuotedHtmlForDisplay(html);
    expect(result).toContain("<p>Hola Brenda,</p>");
    expect(result).toContain("<table>");
    expect(result).not.toContain(
      "Hola Brenda, Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512. Esta actualización fue realizada en base a los nuevos datos o archivos que nos compartió.",
    );
  });

  it("removes plain wall nested inside blockquote before div dir=ltr", () => {
    const plainWall =
      "Hola Brenda, Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512. Esta actualización fue realizada en base a los nuevos datos o archivos que nos compartió.";
    const formatted = `<div dir="ltr"><p>Hola Brenda,</p><p>Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512.</p><p>Esta actualización fue realizada en base a los nuevos datos o archivos que nos compartió.</p><table><tr><td>Latinos Business Support</td></tr></table></div>`;
    const html = `<div class="gmail_quote"><div class="gmail_attr">On Thu, Jun 25, 2026 at 11:56 AM Latinos Business Support wrote:</div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">${plainWall}${formatted}</blockquote></div>`;

    const result = dedupeQuotedHtmlForDisplay(html);
    expect(result).toContain("<p>Hola Brenda,</p>");
    expect(result).toContain("<table>");
    expect(result).not.toContain(
      "Hola Brenda, Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512. Esta actualización fue realizada en base a los nuevos datos o archivos que nos compartió.",
    );
  });

  it("removes duplicate plain quoted paragraphs", () => {
    const first =
      "Hola Brenda, Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street.";
    const second = `Hola Brenda,\n\nLe compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street.\n\nSaludos cordiales,`;

    const result = dedupeQuotedPlainForDisplay(`${first}\n\n${second}`);
    expect(result).toBe(second);
  });

  it("strips trailing duplicate content before quoted section", () => {
    const brenda = `Wall / Apron Flasing\nD&R Siding\n\nSaludos !!`;
    const plainWall =
      "Hola Brenda, Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512.";
    const formatted = `<div class="gmail_quote"><p>Hola Brenda,</p><p>Le compartimos una versión actualizada del estimado correspondiente al caso Re: 44 Elm Street, East Haven, CT, 06512.</p></div>`;
    const content = `<div>${brenda.replace(/\n/g, "<br>")}</div><div>${plainWall}</div>`;

    const result = stripTrailingDuplicateOfQuoted(content, formatted, true);
    expect(result).toContain("Wall / Apron Flasing");
    expect(result).not.toContain(plainWall);
  });
});
