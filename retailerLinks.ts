// Each retailer's own website — general sign-up/plans pages, not a deep link
// to the specific named plan (we don't have those, and they'd go stale fast
// as retailers redesign their sites). The customer searches for the plan
// name shown once they land there. Checked October 2026 — worth a periodic
// click-through to make sure none of these have moved.
export const RETAILER_LINKS: Record<string, string> = {
  AGL: "https://www.agl.com.au",
  "Alinta Energy": "https://www.alintaenergy.com.au",
  "Blue NRG": "https://www.bluenrg.com.au",
  CovaU: "https://www.covau.com.au",
  Dodo: "https://www.dodo.com/energy/victoria",
  EnergyAustralia: "https://www.energyaustralia.com.au",
  "GloBird Energy": "https://www.globirdenergy.com.au",
  "Kogan Energy": "https://www.koganenergy.com.au",
  "Lumo Energy": "https://www.lumoenergy.com.au",
  "Momentum Energy": "https://www.momentumenergy.com.au",
  "Origin Energy": "https://www.originenergy.com.au",
  Powershop: "https://www.powershop.com.au",
  "Red Energy": "https://www.redenergy.com.au",
  Sumo: "https://www.sumo.com.au",
  "Tango Energy": "https://www.tangoenergy.com",
};
