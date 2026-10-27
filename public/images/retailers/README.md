# Retailer logos

Put a retailer's logo in this folder with the exact file name below (plus
.svg or .png) and it shows everywhere that retailer appears: results, the
dashboard and the market board. Until a file exists, the site shows a
coloured badge with the retailer's initials. You can add them gradually.

How to add one:
1. Get the file from the retailer's media kit / brand page, or ask them
   (logos are trademarks: only use files you have permission to use).
2. Save it here as, for example, `origin-energy.svg`.
3. Upload the code and deploy as usual. The list of files is picked up
   automatically when the site builds (`scripts/list-retailer-logos.mjs`).

SVG is best; PNG works (square-ish, at least 200 x 200, transparent background).

| File name (.svg or .png) | Retailer |
|---|---|
| 1st-energy | 1st Energy |
| agl | AGL |
| alinta-energy | Alinta Energy |
| amber-electric | Amber Electric |
| arcline-by-racv-energy | Arcline by RACV - Energy |
| blue-nrg | Blue NRG |
| covau | CovaU |
| diamond-energy | Diamond Energy |
| dodo | Dodo |
| energyaustralia | EnergyAustralia |
| engie | ENGIE |
| flipped-energy | Flipped Energy |
| flow-power | Flow Power |
| globird-energy | GloBird Energy |
| indigo-power | Indigo Power |
| kogan-energy | Kogan Energy |
| lumo-energy | Lumo Energy |
| momentum-energy | Momentum Energy |
| nectr | Nectr |
| next-business-energy | Next Business Energy |
| origin-energy | Origin Energy |
| ovo-energy | OVO Energy |
| powershop | Powershop |
| real-utilities | Real Utilities |
| red-energy | Red Energy |
| sumo | Sumo |
| tango-energy | Tango Energy |

A retailer not listed here? The file name is just the retailer's name in
lower case with anything that isn't a letter or digit replaced by a dash
(`Arcline by RACV - Energy` becomes `arcline-by-racv-energy`).
