import { describe, it, expect } from "vitest";
import { runRuleEngine } from "@/lib/scam/rules";

describe("runRuleEngine", () => {
  it("flags a classic job scam message", () => {
    const result = runRuleEngine(
      "Congratulations! You are selected. Pay a registration fee of ₹2000 before joining to confirm your seat."
    );
    const ids = result.indicators.map((i) => i.type);
    expect(ids).toContain("Registration fee request");
    expect(result.score).toBeGreaterThan(0);
  });

  it("flags OTP requests at full weight when there is no negation", () => {
    const result = runRuleEngine("Please share the OTP sent to your phone to verify your account.");
    const otp = result.indicators.find((i) => i.type === "OTP request");
    expect(otp).toBeDefined();
    expect(otp?.score).toBe(25);
  });

  it("discounts an OTP mention when it's safety advice, not a request", () => {
    const result = runRuleEngine("Reminder: never share your OTP with anyone, including bank staff.");
    const otp = result.indicators.find((i) => i.type === "OTP request");
    expect(otp).toBeDefined();
    expect(otp?.severity).toBe("low");
    expect(otp!.score).toBeLessThan(25);
  });

  it("returns no indicators for a benign message", () => {
    const result = runRuleEngine("Hey, are we still on for lunch tomorrow at noon?");
    expect(result.indicators).toHaveLength(0);
    expect(result.score).toBe(0);
  });

  it("caps the total score at 100", () => {
    const result = runRuleEngine(
      "URGENT: Send money now via UPI, share your OTP, password, PIN, and bank account number and CVV or your account will be suspended. Guaranteed returns! Bitcoin wallet address required. Install AnyDesk for remote access. Gift card payment accepted. You have won a lottery! Registration fee applies, pay before joining."
    );
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
