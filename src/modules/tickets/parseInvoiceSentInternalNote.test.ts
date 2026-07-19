import { describe, expect, it } from "vitest";
import {
  parseInvoiceSentInternalNote,
  previewInvoiceSentInternalNote,
} from "./parseInvoiceSentInternalNote";

const SAMPLE = `**Invoice sent for payment**

- **Invoice:** INV-2026-0059
- **Amount due:** $157.36
- **Due date:** Jul 24, 2026
- **Property:** 445 Greenwich Ave, New Haven, CT 06519

**Turnaround**
- **Total time to send:** 8h 22m
- **New:** 8h 22m
- **Open:** —
- **Waiting:** —

**Timeline**
- Ticket opened · Jul 17, 2026
- Delivery package ready · 1 file · Jul 17, 2026
- Invoice sent for payment · Jul 17, 2026

**Sent by**
- **From:** Latino Business Support <info@lbs.bz>
- **By:** Cristian Villavicencio
- **To:** ctevolution1212@gmail.com
- **Text:** Sent to +12038020469

**Delivery package** (after payment)
- 445GREENWICHAVE_FINAL_DRAFT_DEPREC_CAR.pdf · Supplement · 55 lines · $152.50`;

describe("parseInvoiceSentInternalNote", () => {
  it("parses the verbose invoice-sent note", () => {
    const note = parseInvoiceSentInternalNote(SAMPLE);
    expect(note?.invoiceNumber).toBe("INV-2026-0059");
    expect(note?.amountDue).toBe("$157.36");
    expect(note?.dueDate).toBe("Jul 24, 2026");
    expect(note?.turnaroundTotal).toBe("8h 22m");
    expect(note?.statusNew).toBe("8h 22m");
    expect(note?.to).toBe("ctevolution1212@gmail.com");
    expect(note?.deliverables).toHaveLength(1);
    expect(note?.deliverables[0]?.title).toContain("445GREENWICHAVE");
  });

  it("builds a short collapsed preview", () => {
    expect(previewInvoiceSentInternalNote(SAMPLE)).toBe(
      "Invoice sent · INV-2026-0059 · $157.36 · 8h 22m turnaround",
    );
  });
});
