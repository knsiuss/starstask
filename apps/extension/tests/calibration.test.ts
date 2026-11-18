import { describe, expect, it } from "vitest";

import { injectAttendanceRows, startCalibrationSession } from "../src/core";
import type { CalibrationProfile } from "../src/core";
import { MockDocument, h } from "./dom-mock";

describe("startCalibrationSession", () => {
  it("captures 4-step status selectors and injects across rows", async () => {
    const r1BtnH = h("button", { type: "button" }, "Btn1");
    const r1BtnI = h("button", { type: "button" }, "Btn2");
    const r1BtnS = h("button", { type: "button" }, "Btn3");
    const r1BtnA = h("button", { type: "button" }, "Btn4");

    const r2BtnH = h("button", { type: "button" }, "Btn1");
    const r2BtnI = h("button", { type: "button" }, "Btn2");
    const r2BtnS = h("button", { type: "button" }, "Btn3");
    const r2BtnA = h("button", { type: "button" }, "Btn4");

    const doc = new MockDocument([
      h(
        "table",
        {},
        h(
          "tbody",
          {},
          h(
            "tr",
            {},
            h("td", {}, "220501"),
            h("td", {}, "Nadia"),
            h("td", {}, r1BtnH, r1BtnI, r1BtnS, r1BtnA),
          ),
          h(
            "tr",
            {},
            h("td", {}, "220502"),
            h("td", {}, "Omar"),
            h("td", {}, r2BtnH, r2BtnI, r2BtnS, r2BtnA),
          ),
        ),
      ),
    ]);

    const steps: string[] = [];
    let capturedProfile: CalibrationProfile | undefined;

    startCalibrationSession(
      doc as unknown as Document,
      (profile) => {
        capturedProfile = profile;
      },
      (prompt) => {
        steps.push(prompt);
      },
    );

    doc.simulateClick(r1BtnH);
    doc.simulateClick(r1BtnI);
    doc.simulateClick(r1BtnS);
    doc.simulateClick(r1BtnA);

    expect(steps.length).toBe(4);
    expect(capturedProfile?.mode).toBe("button");
    expect(capturedProfile?.targetColumnIndex).toBe(2);
    expect(capturedProfile?.statusSelectors?.sakit).toBeDefined();

    await injectAttendanceRows(
      doc as unknown as Document,
      [{ nim: "220502", displayName: "Omar", status: "sakit" }],
      { delayMs: 0, calibration: capturedProfile },
    );

    expect(r2BtnS.clickCount).toBe(1);
    expect(r2BtnH.clickCount).toBe(0);
  });

  it("supports early finish with Enter and cancellation with Escape", () => {
    const cb = h("input", { type: "checkbox" });
    const doc = new MockDocument([
      h("table", {}, h("tbody", {}, h("tr", {}, h("td", {}, cb)))),
    ]);

    let completed: CalibrationProfile | undefined;
    startCalibrationSession(doc as unknown as Document, (profile) => {
      completed = profile;
    });

    doc.simulateClick(cb);
    doc.simulateKeyDown("Enter");

    expect(completed?.mode).toBe("checkbox");
    expect(completed?.statusSelectors?.hadir).toBeDefined();

    let cancelledComplete = false;
    const cancel = startCalibrationSession(doc as unknown as Document, () => {
      cancelledComplete = true;
    });
    doc.simulateKeyDown("Escape");
    doc.simulateClick(cb);
    cancel();

    expect(cancelledComplete).toBe(false);
  });
});
