# Wave 8 — Referentie: Storteboom Bestelschema Excel

Dit document beschrijft het **exacte format** van het Excel bestelschema dat Oranjehoen naar Storteboom stuurt.
Bron: `Kopie van BEstelschema Storteboom_.xlsx` (per slachtdag één sheet-tab).

---

## Sheet Layout: Twee helften naast elkaar

| Kolom | A–J | K (leeg) | L–T |
|-------|-----|----------|-----|
| Inhoud | **PUTTEN** (Dag 0) | scheiding | **NIJKERK** (Dag +1) |

---

## LINKERHELFT — PUTTEN (kolom A–J)

### Sectie 1: Algemeen (rij 2–7)

| Rij | A | B | C | D |
|-----|---|---|---|---|
| 2 | Algemeen | P | | |
| 3 | Lotnummer | P2520310 | P2520310 | P2520310 |
| 4 | Mester | Leenders | Leenders | Leenders |
| 5 | Ras | Oranjehoen | | |
| 6 | Hok | 2 | 2 | 2 |
| 7 | Slachtdatum | 24-11-2025 | 24-11-2025 | 24-11-2025 |

### Sectie 2: Aanvoer (rij 9–12)

| Rij | A | B (Aantal) | C (Gewicht) | D (Gem. gewicht) |
|-----|---|-------------|-------------|------------------|
| 9 | Aanvoer | Aantal | Gewicht | Gem. gewicht |
| 10 | Levende Kuikens | 15.820 | 41.923 | 2,65 |
| 11 | Dood aangevoerd | 0 | 0 | |
| 12 | Totaal (levend + dood) | 15.820 | 41.923 | |

### Sectie 3: Slachterij & Rendement (rij 14–30)

| Rij | A | B | C | D | E (Rendement) |
|-----|---|---|---|---|---------------|
| 14 | Slachterij | Aantal | Gewicht | Gem. gewicht | Rendement |
| 15 | Afgekeurd | 57 | 151 | | |
| 17 | Totaal Cat2 | 57 | 151 | | 0,37% |
| 19 | Bloed (Cat3) | | | | 2,70% |
| 20 | Veren (Cat3) | | | | 4,70% |
| ... | (overige Cat3) | | | | |
| 24 | Totaal Cat3 | | | | 20,76% |
| 26 | Nekken | | 826 | | 1,97% |
| 27 | Levers | | 729 | | 1,74% |
| 28 | Magen | | 449 | | 1,07% |
| 29 | Harten | | 80 | | 0,19% |
| 30 | Totaal rendement | | | | 97,1% |

**Samenvatting rendement (kolom H–J, rij 21–27):**

| H | I | J |
|---|---|---|
| Griller | Griller | 71,0% |
| Organs | Levers, magen & harten | 3,0% |
| Neck | Nekken | 1,97% |
| CAT-II | Cat2 | 0,37% |
| CAT-III | Bloed, veren, hoofden | 20,76% |
| Totaal | Totaal | 97,1% |

### Sectie 4: Hele kuikens eruit halen (rij 32–37, kolom H–J)

| H | I (Totaal stuks) | J (KG totaal) |
|---|-------------------|---------------|
| Categorie | Totaal | KG totaal |
| 1500 | 0 | 0 |
| 1600 | 0 | 0 |
| 1800 | 0 | 0 |
| Totaal | 0 | 0 |

### Sectie 5: Inpak Delen (rij 33–37)

| A | B (Aantal) | C (Gewicht) | D (Gem. Griller gew.) | E (Rendement) |
|---|-------------|-------------|----------------------|---------------|
| Gril kuikens | 15.820 | 29.765 | 1,8815 | 71% |
| Zaag kuikens | 1 | 3,2 | 3,20 | |
| Kuikens inpakken | 0 | 0 | | |
| Kuikens delen | 15.819 | 29.762 | 1,8814 | |

### Sectie 6: Beschikbaarheid Putten (rij 44–47)

| A | B (kg beschikbaar) | C (Orders) | D (Over/Tekort) |
|---|---------------------|------------|-----------------|
| Beschikbare Kappen | 10.714 | 0 | 10.714 |
| Beschikbare Zadels | 12.947 | 0 | 12.947 |
| Beschikbare Vleugels | 2.827 | 0 | 2.827 |

### Sectie 7: Orders Putten — Productlijst (rij 49–63)

| A (Omschrijving) | B (Art.Nr Vacuum) | C (Art.Nr niet Vacuum) | D (Rendement) | E (Kg uit stal) | F (Aantal KG besteld) |
|-------------------|-------------------|------------------------|---------------|-----------------|----------------------|
| Hele hoen naakt 1300-1600 | - | 400560 | | | 0 |
| Hele hoen naakt 1700-1800 | - | 400577 | | | 0 |
| Hele hoen naakt 1800-2100 | - | 400584 | | | 0 |
| Hele hoen MAP (voor Zeewolde) | - | | | | 0 |
| Vleugels mix | - | 386055 | 9,57% | 2.848 | 0 |
| Vleugels z tip | - | 382750 | 9,57% | 2.848 | 0 |
| Maagjes | - | 646098 | 1,07% | 318 | 0 |
| Levertjes | - | 656196 | 1,74% | 518 | 0 |
| Hartjes | - | 636044 | 0,19% | 57 | 0 |
| Nekken | - | 608225 | 1,97% | 586 | 0 |
| Drumsticks 10kg | - | 442133 | 16,56% | 4.928 | 0 |
| Borstkappen met vel | - | 325016 | 36,75% | 10.938 | 0 |
| Dij anatomisch | - | 400553 | 14,68% | 4.370 | 0 |
| Karkas | | | | | 0 |

### Sectie 8: Klant-orders Putten (rij 67–)

| A (Product) | B (Art.Nr) | C (Grutto) | D (Crisp) | E (Cuno) | F (Driessen) | G (Corvoet) | H–I (Leenders) | J (Totaal) |
|-------------|-----------|-----------|----------|---------|------------|-----------|-------------|----------|
| *Afleveradres* | | Pieter van Meel | Pieter van Meel | Goor | Tennesseedreef 24 | Zaandam | Pieter/Groenvries | |
| *Transport Koops* | | | | | nee | Nee | Ja | |
| *Bezorgdag* | | Dinsdag | Dinsdag | Dinsdag | Woensdag | Dinsdag | Dinsdag | |
| Hele hoen 1300-1600 | 400560 | | | | | | | **SOM** |
| Hele hoen 1700-1800 | 400577 | | | | | | | **SOM** |
| ... | | | | | | | | |
| Dij anatomisch | 400553 | | | | | | | **SOM** |
| Karkas | | | | | | | | **SOM** |

---

## RECHTERHELFT — NIJKERK (kolom M–T)

### Beschikbaarheid Nijkerk (rij 44–)

| M | N | O (Orders) | P (Over/Tekort) |
|---|---|------------|-----------------|
| Kappen → | Filet m Haas | 0 | 7.286 |
| | Filet Z Haas | 0 | 6.000 |
| | Haas | 0 | 1.286 |
| Zadels → | Dijvlees | 0 | 3.625 |
| | Drumsticks | 0 | 4.013 |
| | Drumvlees | 0 | 1.967 |

### Orders Nijkerk — Productlijst (rij 58–)

| M (Omschrijving) | N (Art.Nr Vacuum) | O (Art.Nr niet Vacuum) | P (Griller %) | Q (Kg uit stal) | R (Aantal kg) |
|-------------------|-------------------|------------------------|---------------|-----------------|--------------|
| OH flt half, zonder vel MET haas | | 539574 | | | 0 |
| OH Haasjes | 514298 | 598328 | | | 0 |
| OH flt half, zonder vel zonder haas | 540457 | 540327 | 24,42% | 7.268 | 0 |
| Dijfilet 15 kg vacuum | 392940 | 392841 | 9,25% | 2.753 | 0 |
| Kipfilet blokjes 10-15 | 514281 | 513222 | 24,42% | 7.268 | 0 |
| Karkas 250kg | - | 669967 | | | 0 |
| Vel 15kg | | 849079 | 3,17% | 943 | 0 |
| Drumsticks 15kg | | 442140 | 16,56% | 4.928 | 0 |
| Drumvlees 15kg | 430574 | 430406 | 10,43% | 3.104 | 0 |

### Klant-orders Nijkerk (rij 67–)

| M (Product) | N (artnr VAC) | O (Artnr niet vac) | P (Grutto) | Q (Crisp) | R (Driessen) | S (Corvoet) | T (Cuno) |
|-------------|---------------|---------------------|-----------|----------|------------|-----------|---------|
| *Afleveradres* | | | Pieter van Meel | Pieter van Meel | Tennesseedreef 24 | Zaandam | Goor |
| *Transport Koops* | | | Nee | Nee | Ja | Ja | Ja |
| *Bezorgdag* | | | Woensdag | Woensdag | Woensdag | Woensdag | Donderdag |
| OH flt half, zonder vel zonder | 540457 | 540327 | | | | | |
| Dijfilet 15 kg vacuum | 392940 | 392841 | | | | | |
| ... | | | | | | | |

---

## Artikelnummers Master (Blad1 in Excel)

| Product | Art.Nr Vacuum | Art.Nr Niet-Vacuum | Verpakking |
|---------|---------------|--------------------|-----------|
| OH flt half, zonder vel zonder haas | 540457 | 540327 | 15kg |
| Dijfilet 15 kg vacuum | 392940 | 392841 | 15kg |
| Kipfilet blokjes 10-15 | - | 513222 | 15kg |
| Vleugels mix | - | 386055 | 10kg |
| Vleugels z tip | - | 382750 | 10kg |
| Karkas 250kg | - | 669967 | 250kg |
| Maagjes | - | 646098 | 10kg |
| Levertjes | - | 656196 | 10kg |
| Hartjes | - | 636044 | 10kg |
| Nekken | - | 608225 | 10kg |
| Drumsticks 15kg | - | 442140 | 15kg |
| Drumsticks 10kg | - | 442133 | 10kg |
| Drumvlees | 430574 | 430406 | 15kg |
| Hele hoen naakt 1300-1600 | - | 400560 | 11,6kg |
| Hele hoen naakt 1700-1800 | - | 400577 | 14kg |
| Hele hoen naakt 1800-2100 | - | 400584 | 15,6kg |
| Hele hoen MAP | - | - | |
| Borstkappen met vel | - | 325016 | 11,5kg |
| OH flt half, zonder vel MET haas | - | 539574 | |
| OH Haasjes | 514298 | 598328 | |
| Filet zonder vel, zonder haas 195-220 | - | 540617 | |
| Offcuts | - | 528356 | |
| Vel 15kg | - | 849079 | |

---

## Klanten in het bestelschema

**Putten klant-kolommen:** Grutto, Crisp PM Geel, Cuno, Driessen, Corvoet, Leenders (2x kolom), Totaal
**Nijkerk klant-kolommen:** Grutto, Crisp, Driessen, Corvoet, Cuno

**Per klant 3 header-rijen:**
1. Afleveradres
2. Transport door Koops (Ja/Nee)
3. Welke dag bezorgen (Dinsdag/Woensdag/Donderdag)

---

## Kernregels Massabalans

1. `Totaal levend gewicht = Levende kuikens × Gem. gewicht`
2. `Griller kg = (Levend - Cat2 - Cat3) × Griller rendement%`
3. `Griller kg - Hele hoenen eruit = Beschikbaar voor delen`
4. `Per product: Beschikbaar kg = Griller kg × Rendement%`
5. `Over/Tekort = Beschikbaar kg - SOM(alle klant-orders kg)`
6. `Putten kappen → Nijkerk filet + haas (cascade)`
7. `Putten zadels → Nijkerk dijvlees + drumsticks + drumvlees (cascade)`
8. **REST-kolom = Beschikbaar - Totaal besteld** (moet ≥ 0 zijn, anders tekort)
