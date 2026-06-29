import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { memberHasVoiceCallCapability } from "@/lib/permissions/voiceCallCapability";

describe("memberHasVoiceCallCapability", () => {
  it("grants workspace administrators", () => {
    assert.equal(
      memberHasVoiceCallCapability({ administrator: true, module_permissions: null }),
      true,
    );
  });

  it("grants admin preset even when voice.calls.make was saved false before voice shipped", () => {
    assert.equal(
      memberHasVoiceCallCapability({
        administrator: false,
        module_permissions: {
          _role_preset: "admin",
          "voice.calls.make": false,
        },
      }),
      false,
    );
  });

  it("grants admin preset when voice.calls.make is true", () => {
    assert.equal(
      memberHasVoiceCallCapability({
        administrator: false,
        module_permissions: {
          _role_preset: "admin",
          "voice.calls.make": true,
        },
      }),
      true,
    );
  });

  it("grants admin preset when voice capability is inherited from preset only", () => {
    assert.equal(
      memberHasVoiceCallCapability({
        administrator: false,
        module_permissions: { _role_preset: "admin" },
      }),
      true,
    );
  });

  it("grants legacy sales_manager roles without module_permissions", () => {
    assert.equal(
      memberHasVoiceCallCapability({
        administrator: false,
        roles: ["sales_manager"],
        module_permissions: null,
      }),
      true,
    );
  });

  it("denies read-only preset without override", () => {
    assert.equal(
      memberHasVoiceCallCapability({
        administrator: false,
        module_permissions: { _role_preset: "read_only" },
      }),
      false,
    );
  });
});
