import { describe, expect, it } from "vitest";
import { htmlToPlainText } from "@/modules/tickets/ticketReplyRichText";

describe("htmlToPlainText", () => {
  it("preserves paragraph breaks from composer HTML", () => {
    const html = [
      "<p>Gracias por confirmar el nuevo presupuesto revisado para el caso en mención.</p>",
      "<p>El documento actualizado es adjunto en este correo: 57MARWICK11_FINAL_DRAFT_DEPREC_CAR.pdf</p>",
      "<p>Le indico que por la hora solo me encontraba disponible para ayudarle.</p>",
      "<p>Quedamos atentos a cualquier consulta o comentario.</p>",
      "<p>Saludos cordiales,</p>",
    ].join("");

    const plain = htmlToPlainText(html);

    expect(plain).toContain("para ayudarle.\n\nQuedamos");
    expect(plain).toContain("comentario.\n\nSaludos cordiales,");
  });

  it("preserves line breaks from br tags", () => {
    const html =
      "<p>Primera línea.<br>Segunda línea.</p>";

    expect(htmlToPlainText(html)).toBe("Primera línea.\nSegunda línea.");
  });
});
