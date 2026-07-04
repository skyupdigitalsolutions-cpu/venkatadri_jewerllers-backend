// ─── Default Terms and Conditions for a Gold Savings Scheme ─────────────
// Auto-seeded for new admins. They can edit later from the admin dashboard.
// Plain text with simple markdown-style headings; the frontend can render
// or display as-is.
// ───────────────────────────────────────────────────────────────────────

const DEFAULT_TERMS = `# Gold Savings Scheme — Terms and Conditions

Please read these Terms and Conditions ("Terms") carefully before joining the Gold Savings Scheme ("Scheme") offered by {{SHOP_NAME}} ("the Shop"). By joining the Scheme, you ("the Customer") agree to be bound by these Terms.

## 1. Eligibility
- The Customer must be 18 years of age or older.
- The Customer must provide valid KYC documents (Aadhaar card, photograph, and any other documents requested by the Shop).
- The Customer must provide accurate and current personal information.

## 2. Scheme Structure
- The Scheme runs for a total of 12 months.
- The Customer pays a fixed monthly amount for 11 months. The minimum monthly amount is ₹6,000.
- For the 12th month, the Shop will contribute a bonus equivalent to one month's installment, subject to clause 5.

## 3. Gold Accumulation
- Each monthly payment is converted to gold grams based on the gold rate set by the Shop on the day the payment is received and verified.
- Gold rates are determined by the Shop based on prevailing market rates and may change daily.
- The total grams accumulated will be the sum of grams credited each month.

## 4. Payments
- Payments are due on the same date of each calendar month, based on the date of joining.
- Payments can be made via UPI, bank transfer, or any other method approved by the Shop.
- Customer is responsible for submitting payment proof (UTR / screenshot) for verification.
- Late payments may be subject to a grace period as decided by the Shop. Repeated late payments may lead to scheme suspension.

## 5. Bonus Month (12th Month)
- The bonus contribution by the Shop will be credited only upon successful completion of all 11 customer installments within the scheme tenure.
- If the Customer exits the Scheme before completing all 11 installments, the bonus will be forfeited.

## 6. Early Exit
- The Customer may exit the Scheme before completion. In such case:
  - The Customer will receive only the gold grams accumulated from the installments actually paid.
  - The Shop's bonus contribution will not be credited.
  - Any administrative fees, if applicable, will be deducted as per the Shop's policy.

## 7. Maturity and Collection
- On scheme completion, the accumulated gold can be redeemed at the Shop in the form of jewellery of equivalent value.
- Redemption is subject to the Shop's gold designs and availability.
- Making charges, wastage, GST, and other applicable charges on jewellery will be paid by the Customer separately, unless otherwise specified.
- Cash redemption is not permitted.

## 8. Identity & Account
- The Customer's account is non-transferable.
- The Customer must keep their login credentials confidential.
- The Shop is not liable for any unauthorised access caused by the Customer's negligence.

## 9. Communication
- The Customer agrees to receive scheme-related communication via SMS, WhatsApp, email and phone calls.
- Reminders for due dates, gold rate updates, and payment confirmations will be sent through these channels.

## 10. Modifications to Terms
- The Shop reserves the right to modify these Terms with prior notice.
- The Customer will be required to accept any updated Terms before continuing to use the Scheme.

## 11. Disputes
- All disputes shall be subject to the exclusive jurisdiction of the courts in {{SHOP_CITY}}, India.
- Customers are encouraged to first raise concerns with the Shop directly for amicable resolution.

## 12. Cancellation by the Shop
- The Shop reserves the right to cancel a Customer's enrolment in case of:
  - Fraudulent activity or misrepresentation
  - Non-payment for three or more consecutive months
  - Violation of any of these Terms

## 13. Privacy
- Customer information is used solely for scheme administration and communication.
- Personal information is not shared with third parties except as required by law.

## 14. Acceptance
By clicking "I Agree" during registration or scheme enrolment, the Customer acknowledges that they have read, understood and accepted these Terms.

---

Last updated: {{LAST_UPDATED}}
Shop: {{SHOP_NAME}}
Contact: {{SHOP_PHONE}}
`;

module.exports = { DEFAULT_TERMS };