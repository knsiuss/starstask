import { describe, expect, it } from "vitest";

import {
  developerIncidentCreateSchema,
  developerIncidentNoteSchema,
  developerIncidentStatusSchema,
  developerLogsQuerySchema,
  developerSecurityQuerySchema,
} from "@starstask/contracts";

describe("developerLogsQuerySchema", () => {
  it("applies defaults when no filters are provided", () => {
    const result = developerLogsQuerySchema.parse({});

    expect(result).toEqual({
      range: "30d",
      search: undefined,
      page: 1,
      pageSize: 25,
    });
  });

  it("coerces numeric query parameters from the address", () => {
    const result = developerLogsQuerySchema.parse({
      range: "7d",
      page: "3",
      pageSize: "50",
    });

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
    expect(result.range).toBe("7d");
  });

  it("rejects an unknown range and an oversized page size", () => {
    expect(developerLogsQuerySchema.safeParse({ range: "1h" }).success).toBe(
      false,
    );
    expect(
      developerLogsQuerySchema.safeParse({ pageSize: "1000" }).success,
    ).toBe(false);
  });

  it("treats a blank search as absent", () => {
    const result = developerLogsQuerySchema.parse({ search: "   " });

    expect(result.search).toBeUndefined();
  });
});

describe("developerSecurityQuerySchema", () => {
  it("defaults to the audit trail", () => {
    const result = developerSecurityQuerySchema.parse({});

    expect(result.source).toBe("audit");
    expect(result.page).toBe(1);
  });

  it("accepts every documented event stream", () => {
    for (const source of ["audit", "auth_failures", "auth_successes"]) {
      expect(developerSecurityQuerySchema.safeParse({ source }).success).toBe(
        true,
      );
    }
  });

  it("rejects an unknown stream", () => {
    expect(
      developerSecurityQuerySchema.safeParse({ source: "everything" }).success,
    ).toBe(false);
  });
});

describe("developerIncidentCreateSchema", () => {
  it("accepts a title with a default severity", () => {
    const result = developerIncidentCreateSchema.parse({
      title: "Database latency spike",
    });

    expect(result.severity).toBe("medium");
    expect(result.note).toBeUndefined();
  });

  it("rejects a title below three characters", () => {
    expect(
      developerIncidentCreateSchema.safeParse({ title: "db" }).success,
    ).toBe(false);
  });

  it("rejects an unknown severity", () => {
    expect(
      developerIncidentCreateSchema.safeParse({
        title: "Valid title",
        severity: "critical",
      }).success,
    ).toBe(false);
  });

  it("keeps an optional opening note", () => {
    const result = developerIncidentCreateSchema.parse({
      title: "Valid title",
      note: "p95 latency doubled after the last deploy",
    });

    expect(result.note).toBe("p95 latency doubled after the last deploy");
  });
});

describe("developerIncidentStatusSchema", () => {
  it("accepts only documented statuses", () => {
    expect(
      developerIncidentStatusSchema.safeParse({ status: "resolved" }).success,
    ).toBe(true);
    expect(
      developerIncidentStatusSchema.safeParse({ status: "closed" }).success,
    ).toBe(false);
  });
});

describe("developerIncidentNoteSchema", () => {
  it("rejects an empty note", () => {
    expect(developerIncidentNoteSchema.safeParse({ body: "   " }).success).toBe(
      false,
    );
  });

  it("rejects a note beyond the stored bound", () => {
    expect(
      developerIncidentNoteSchema.safeParse({ body: "x".repeat(2001) }).success,
    ).toBe(false);
  });
});
