"""Two Meridian loan applications that exercise both branches of the gate.

Condensed from ../foundry-workflow/sample-applications.md.
- 'small' is clean and within delegated authority -> auto-finalizes.
- 'large' is material / borderline -> pulls in a human sign-off.
"""

SAMPLES = {
    "small": (
        "Commercial loan application. Business: Bayfront Coffee Roasters LLC, specialty coffee "
        "roaster, 7 years in business. Requested amount: $85,000 over 60 months to buy a roaster. "
        "Annual revenue: $940,000. Net operating income: $180,000. Existing annual debt service: "
        "$22,000. Collateral: equipment valued $120,000. Owner credit score: 742."
    ),
    "large": (
        "Commercial loan application. Business: Meridian Heights Development Corp, commercial real "
        "estate, 3 years in business. Requested amount: $2,400,000 over 120 months for an "
        "acquisition. Annual revenue: $1,300,000. Net operating income: $210,000. Existing annual "
        "debt service: $95,000. Collateral: property valued $2,600,000. Owner credit score: 648."
    ),
}

# Expected human-signoff outcome, used by the eval harness (Module 08).
EXPECTED = {"small": False, "large": True}
